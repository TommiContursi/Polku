"""Local containment must agree with original rings, without invented shoreline."""
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from xml.sax.saxutils import escape

from pmtiles.reader import MemorySource, Reader
from tools.osm_data import geometry as g

STAMP={'url':'https://download.geofabrik.de/europe-261031.osm.pbf','timestamp':'2026-10-31T21:23:06Z','sha256':'a'*64,'bytes':100}
COVERAGE={'type':'Polygon','coordinates':[[[-.3,-.3],[.3,-.3],[.3,.3],[-.3,.3],[-.3,-.3]]]}

def digest(e):
    return hashlib.sha256(json.dumps(e,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def point_in_rings(rings,ll):
    x,y=ll;inside=False
    for ring in rings:
        for a,b in zip(ring,ring[1:]):
            if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.nodes={1:(-.1,-.1),2:(.1,-.1),3:(.1,.1),4:(-.1,.1),5:(.005,-.03),6:(.03,-.03),7:(.03,-.005),8:(.005,-.005),9:(.2,.2)}
        self.ways={11:([1,2,3,4,1],{}),12:([5,6,7,8,5],{}),13:([5,7],{'barrier':'fence'})}
        self.relations={100:({'type':'multipolygon','natural':'water','name':'Lake'},[('way',11,'outer'),('way',12,'inner'),('node',9,'label')])}
        self.roots={('relation',100):{'area':True,'inspection':True},('way',13):{'area':False,'inspection':True}}

    def build(self,*,suffix='one',expected_change=None,progress=None):
        self.nodes={n:tuple(round(float(v),7) for v in p) for n,p in self.nodes.items()}
        elements=[];xml=['<osm version="0.6">']
        for ref,(lon,lat) in sorted(self.nodes.items()):
            e={'type':'node','id':ref,'lon':lon,'lat':lat,'tags':{}};elements.append(e);xml.append(f'<node id="{ref}" lon="{lon}" lat="{lat}"/>')
        for ref,(nodes,tags) in sorted(self.ways.items()):
            elements.append({'type':'way','id':ref,'tags':tags,'nodes':nodes,'geometry':[{'lon':self.nodes[n][0],'lat':self.nodes[n][1]} for n in nodes]})
            xml.append(f'<way id="{ref}">'+''.join(f'<nd ref="{n}"/>' for n in nodes)+''.join(f'<tag k="{escape(k)}" v="{escape(v)}"/>' for k,v in tags.items())+'</way>')
        for ref,(tags,members) in sorted(self.relations.items()):
            elements.append({'type':'relation','id':ref,'tags':tags,'members':[{'type':t,'ref':r,'role':role} for t,r,role in members]})
            xml.append(f'<relation id="{ref}">'+''.join(f'<member type="{t}" ref="{r}" role="{role}"/>' for t,r,role in members)+''.join(f'<tag k="{escape(k)}" v="{escape(v)}"/>' for k,v in tags.items())+'</relation>')
        xml.append('</osm>');source=self.root/(suffix+'.osm');source.write_text(''.join(xml));output=self.root/(suffix+'.pmtiles')
        expected={(e['type'],e['id']):digest(e) for e in elements}
        if expected_change:expected.update(expected_change)
        report=g.compile_geometry(source,self.roots,expected,output,STAMP,[COVERAGE],**({'progress':progress} if progress else {}))
        return output,report

    def test_progress_reports_stages_without_changing_the_archive(self):
        original,_=self.build(suffix='baseline');events=[]
        observed,_=self.build(suffix='progress',progress=lambda stage,**fields:events.append((stage,fields)))
        self.assertEqual(original.read_bytes(),observed.read_bytes())
        stages=[stage for stage,_ in events]
        self.assertEqual(stages[0],'read_originals')
        self.assertIn('index_nodes',stages);self.assertIn('tile_objects',stages);self.assertIn('write_tiles',stages)
        self.assertEqual(stages[-1],'complete')

    @staticmethod
    def read(output,ll):
        xy=g.tile_xy(*ll);reader=Reader(MemorySource(output.read_bytes()));data=reader.get(g.ZOOM,*xy)
        return json.loads(gzip.decompress(data)) if data else {'schema':2,'tile':[g.ZOOM,*xy],'elements':[]}

    def test_interior_tile_with_no_boundary_preserves_hole_and_original_area_bounds(self):
        out,report=self.build();tile=self.read(out,[.06,-.06]);lake=next(e for e in tile['elements'] if e['id']==100)
        self.assertTrue(g.contains_area(lake,tile['tile'],[.06,-.06]))
        self.assertEqual(lake['area']['bounds'],[-.1,-.1,.1,.1]);self.assertTrue(lake['area']['complete'])
        self.assertFalse(lake['fragments'],'an interior must not invent a rectangle outline')
        hole=self.read(out,[.02,-.02]);self.assertFalse(any(g.contains_area(e,hole['tile'],[.02,-.02]) for e in hole['elements'] if 'area' in e))
        self.assertTrue(report['dataset']['areas_complete']);self.assertTrue(report['dataset']['nearby_complete'])

    def test_local_membership_agrees_with_whole_rings_including_tile_edges(self):
        out,_=self.build();rings=[[self.nodes[i] for i in [1,2,3,4,1]],[self.nodes[i] for i in [5,6,7,8,5]]]
        for ll in [[0,0],[0,-.0439453125],[.001,-.001],[.02,-.02],[.06,-.06],[.11,0],[-.1,-.1],[.1,.1]]:
            tile=self.read(out,ll);actual=any(g.contains_area(e,tile['tile'],ll) for e in tile['elements'] if e.get('area',{}).get('complete'))
            self.assertEqual(actual,point_in_rings(rings,ll),ll)

    def test_original_paths_nodes_positions_roles_and_typed_id_are_retained(self):
        self.nodes[100]=(.01,-.01);self.roots['node',100]={'area':False,'inspection':True}
        out,_=self.build();tile=self.read(out,[.01,-.01]);self.assertEqual({e['type'] for e in tile['elements'] if e['id']==100},{'node','relation'})
        lake=next(e for e in tile['elements'] if e['type']=='relation');self.assertEqual(lake['member_count'],3)
        fragments=[f for f in lake['fragments'] if f['type']=='way'];self.assertTrue(fragments)
        for f in fragments:
            self.assertEqual(f['path'][0][0],100);self.assertEqual(f['path'][-1][3],f['ref']);self.assertEqual(f['path'][-1][5],3)
            original=self.ways[f['ref']][0];self.assertEqual(f['nodes'],original[f['start']:f['start']+len(f['nodes'])])
            self.assertEqual(f['geometry'],[list(self.nodes[n]) for n in f['nodes']])
        for p in lake['area']['polygons']:
            for fi,segment,inner in p['edges']:
                f=lake['fragments'][fi];self.assertIn(f['ref'],[11,12]);self.assertEqual(inner,f['ref']==12);self.assertLess(segment,len(f['nodes'])-1)

    def test_nested_relations_keep_original_member_paths_and_missing_geometry_is_explicit(self):
        self.relations[101]=({'tourism':'camp_site'},[('relation',100,'part'),('way',999,'missing')]);self.roots['relation',101]={'area':False,'inspection':True}
        out,report=self.build();self.assertFalse(report['dataset']['nearby_complete']);self.assertTrue(report['dataset']['areas_complete'])
        e=next(e for e in self.read(out,[.01,-.01])['elements'] if e['id']==101)
        self.assertTrue(e['incomplete']);self.assertIsNone(e['bounds'])
        path=next(f['path'] for f in e['fragments'] if len(f['path'])==2);self.assertEqual(path[0],[101,0,'relation',100,'part',2]);self.assertEqual(path[1][0],100)

    def test_missing_outer_member_cannot_be_reported_as_complete_or_valid_empty(self):
        self.relations[100][1].append(('way',999,'outer'))
        out,report=self.build();self.assertFalse(report['dataset']['areas_complete']);self.assertFalse(report['dataset']['nearby_complete'])

    def test_cyclic_member_graph_is_incomplete_and_does_not_loop(self):
        self.relations[101]=({'tourism':'camp_site'},[('relation',101,'part')]);self.roots['relation',101]={'area':False,'inspection':True}
        _,report=self.build();self.assertFalse(report['dataset']['nearby_complete'])

    def test_conflicting_original_identity_fails_before_an_archive_is_exposed(self):
        with self.assertRaisesRegex(ValueError,'identity|Identity'):
            self.build(expected_change={('way',11):'f'*64})
        self.assertFalse((self.root/'one.pmtiles').exists())

    def test_invalid_ring_has_known_uncertain_bounds_instead_of_poisoning_other_areas(self):
        self.ways[12]=([5,6,7,8],{})
        out,report=self.build();self.assertTrue(report['dataset']['areas_complete'])
        tile=self.read(out,[.06,-.06]);e=next(e for e in tile['elements'] if e['id']==100)
        self.assertFalse(e['area']['complete']);self.assertEqual(e['area']['bounds'],[-.1,-.1,.1,.1])
        with self.assertRaisesRegex(ValueError,'incomplete|Incomplete'):g.contains_area(e,tile['tile'],[.06,-.06])

    def assert_membership(self, out, polygons, points):
        for ll in points:
            tile=self.read(out,ll)
            actual=any(g.contains_area(e,tile['tile'],ll) for e in tile['elements'] if e.get('area',{}).get('complete'))
            self.assertEqual(actual,any(point_in_rings(rings,ll) for rings in polygons),ll)

    def test_disconnected_outers_holes_and_island_use_union_of_original_rings(self):
        self.nodes.update({20:(.13,-.08),21:(.19,-.08),22:(.19,-.02),23:(.13,-.02),
                           24:(.01,-.025),25:(.02,-.025),26:(.02,-.015),27:(.01,-.015)})
        self.ways[20]=([20,21,22,23,20],{});self.ways[21]=([24,25,26,27,24],{})
        self.relations[100][1].extend([('way',20,'outer'),('way',21,'outer')])
        out,_=self.build()
        polygons=[[[self.nodes[i] for i in self.ways[w][0]] for w in [11,12]],
                  [[self.nodes[i] for i in self.ways[20][0]]],[[self.nodes[i] for i in self.ways[21][0]]]]
        self.assert_membership(out,polygons,[[.15,-.05],[.11,-.05],[.015,-.02],[.025,-.02],[.06,-.06]])

    def test_concave_thin_area_and_off_tile_vertices_match_whole_polygon(self):
        coords=[(-.1,-.1),(.1,-.1),(.1,-.0439453125),(0,-.0439453125),(.1,-.0439),(.1,.1),(-.1,.1)]
        self.nodes={i+1:p for i,p in enumerate(coords)}
        self.ways={11:([1,2,3,4,5,6,7,1],{})};self.relations[100]=({'type':'multipolygon','natural':'water'},[('way',11,'outer')]);self.roots={('relation',100):{'area':True,'inspection':True}}
        out,_=self.build();ring=[self.nodes[n] for n in self.ways[11][0]]
        points=[[x,y] for x in [-.11,-.1,-.087890625,-.01,0,.0439453125,.09,.1,.11] for y in [-.1,-.0439453125,-.04393,0,.1]]
        self.assert_membership(out,[[ring]],points)

    def test_split_reversed_members_keep_their_own_source_direction(self):
        self.ways={11:([1,2,3],{}),12:([1,4,3],{})}
        self.relations[100]=({'type':'multipolygon','natural':'water'},[('way',12,'outer'),('way',11,'outer')]);self.roots={('relation',100):{'area':True,'inspection':True}}
        out,_=self.build();self.assert_membership(out,[[[self.nodes[n] for n in [1,2,3,4,1]]]],[[0,0],[.11,0],[-.09,.09]])
        for ll in [[-.09,.09],[.09,-.09]]:
            for e in self.read(out,ll)['elements']:
                for f in e['fragments']:
                    self.assertEqual(f['nodes'],self.ways[f['ref']][0][f['start']:f['start']+len(f['nodes'])])

    def test_missing_nested_outline_is_not_localized_by_surviving_members(self):
        self.relations[101]=({'type':'multipolygon'},[('way',999,'outer')])
        self.relations[100][1].append(('relation',101,'outer'))
        _,report=self.build();self.assertFalse(report['dataset']['areas_complete'])

    def test_empty_inspection_relation_cannot_certify_nearby_absence(self):
        self.relations[101]=({'tourism':'camp_site'},[]);self.roots['relation',101]={'area':False,'inspection':True}
        _,report=self.build();self.assertFalse(report['dataset']['nearby_complete'])

    def test_missing_label_does_not_invalidate_complete_outline(self):
        self.relations[100][1].append(('node',999,'label'))
        out,report=self.build();self.assertFalse(report['dataset']['nearby_complete']);self.assertTrue(report['dataset']['areas_complete'])
        e=next(e for e in self.read(out,[.06,-.06])['elements'] if e['id']==100)
        self.assertTrue(e['area']['complete']);self.assertTrue(g.contains_area(e,self.read(out,[.06,-.06])['tile'],[.06,-.06]))

    def test_non_outline_member_with_same_nodes_cannot_toggle_containment(self):
        self.ways[14]=(self.ways[11][0],{})
        self.relations[100][1].append(('way',14,'label'))
        out,_=self.build();rings=[[self.nodes[n] for n in self.ways[w][0]] for w in [11,12]]
        self.assert_membership(out,[rings],[[.09,0],[.09,.09],[-.09,-.09],[.02,-.02]])

    def test_adjacent_outers_sharing_an_original_edge_do_not_double_toggle(self):
        self.nodes.update({20:(.2,-.1),21:(.2,.1)})
        self.ways[20]=([2,20,21,3,2],{})
        self.relations[100][1].append(('way',20,'outer'))
        out,_=self.build();polygons=[[[self.nodes[n] for n in self.ways[w][0]] for w in [11,12]],[[self.nodes[n] for n in self.ways[20][0]]]]
        self.assert_membership(out,polygons,[[.09,0],[.11,0],[.2,0],[.1,.09],[.09,.09]])

    def test_backtracking_spur_keeps_original_nodes_and_complete_containment(self):
        self.nodes[20]=(.15,-.1);self.ways[11]=([1,2,20,2,3,4,1],{})
        out,_=self.build();e=next(e for e in self.read(out,[.06,-.06])['elements'] if e['id']==100)
        self.assertTrue(e['area']['complete'])
        self.assert_membership(out,[[[self.nodes[n] for n in self.ways[w][0]] for w in [11,12]]],[[.06,-.06],[.13,-.09],[.02,-.02]])
        fs=[f for e in self.read(out,[.13,-.1])['elements'] for f in e['fragments'] if f['ref']==11]
        self.assertTrue(any(20 in f['nodes'] for f in fs))

    def test_a_removed_closed_cycle_is_not_equivalent_to_a_removed_spur(self):
        from collections import Counter
        ring=Counter({(1,2):1,(2,3):1,(1,3):1})
        self.assertFalse(g.same_boundary(ring+ring,Counter()))
        self.assertFalse(g.same_boundary(ring,Counter()))
        self.assertTrue(g.same_boundary(ring+Counter({(3,4):2}),ring))

    def test_browser_fixture_is_actual_compiler_output(self):
        out,_=self.build();rings=[[self.nodes[n] for n in self.ways[w][0]] for w in [11,12]]
        fixtures=json.loads((Path(__file__).parent.parent/'fixtures/osm-geometry.json').read_text())
        archive=Path(__file__).parent.parent/'fixtures/osm-geometry.pmtiles'
        for row in fixtures:
            self.assertEqual(row['json'],self.read(archive,row['point']))
            self.assertEqual(row['json'],self.read(out,row['point']))
            self.assertEqual(row['inside'],point_in_rings(rings,row['point']))

    def test_polygon_key_is_independent_of_winding_and_start_node(self):
        out,_=self.build();key=self.read(out,[.06,-.06])['elements'][0]['area']['polygons'][0]['id']
        self.ways[11]=([3,2,1,4,3],{})
        out,_=self.build(suffix='reversed');self.assertEqual(key,self.read(out,[.06,-.06])['elements'][0]['area']['polygons'][0]['id'])

    def test_closed_way_area_keeps_primitive_identity_without_a_member_path(self):
        self.ways[11]=(self.ways[11][0],{'natural':'water','name':'Small lake'})
        self.roots={('way',11):{'area':True,'inspection':True}}
        out,_=self.build();tile=self.read(out,[.09,0]);e=tile['elements'][0]
        self.assertTrue(e['area']['complete']);self.assertEqual(e['type'],'way')
        self.assertTrue(g.contains_area(e,tile['tile'],[.09,0]))
        self.assertTrue(all(f['path']==[] and f['identity']==e['identity'] for f in e['fragments']))

    def consumer_objects(self):
        self.nodes.update({20:(.05,-.07),21:(.07,-.07),22:(.07,-.05),23:(.05,-.05),
                           24:(.055,-.065),25:(.065,-.065),26:(.065,-.055),27:(.055,-.055),
                           30:(.0598,-.06),31:(.2,.2),32:(0.,-.12),33:(.12,0.)})
        self.ways[200]=([20,21,22,23,20],{'natural':'water','name':'Small lake'})
        self.ways[201]=([24,25,26,27,24],{'natural':'water'})
        self.relations[200]=({'amenity':'shelter','name':'Nearby member'},[('node',30,'entry'),('node',31,'far')])
        self.relations[201]=({'tourism':'viewpoint','name':'Centre only'},[('node',32,'one'),('node',33,'two')])
        for ref in [200,201]:
            self.roots['way',ref]={'area':True,'inspection':True}
            self.roots['relation',ref]={'area':False,'inspection':True}

    def test_consumer_fixture_retains_small_named_area_and_real_relation_members(self):
        self.consumer_objects();out,_=self.build()
        fixture=Path(__file__).parent.parent/'fixtures/osm-area-consumers.pmtiles'
        for ll in [[.06,-.06],[-.005,.05],[.02,-.02],[.2,.2]]:
            self.assertEqual(self.read(fixture,ll),self.read(out,ll))
        tile=self.read(out,[.06,-.06]);types={e['type'] for e in tile['elements'] if e['id']==200}
        self.assertEqual(types,{'way','relation'})
        small=next(e for e in tile['elements'] if e['type']=='way' and e['id']==200)
        self.assertTrue(g.contains_area(small,tile['tile'],[.06,-.06]))

    def test_source_and_archive_bytes_are_deterministic(self):
        a,_=self.build(suffix='a');b,_=self.build(suffix='b');self.assertEqual(a.read_bytes(),b.read_bytes())

    def test_empty_geometry_product_is_explicit_schema2(self):
        self.roots={};out,report=self.build();self.assertEqual(report['dataset']['schema'],2)
        self.assertTrue(report['dataset']['areas_complete']);self.assertTrue(report['dataset']['nearby_complete'])
        self.assertEqual(self.read(out,[.06,-.06])['elements'],[])
