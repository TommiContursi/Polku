"""Polku's "Short cuts ok" profiles (#106): brouter.de's stock profiles plus one variable,
allow_private (0 = exactly the stock profile), that lets ways and gates marked
access=private (and the sport's own =private) through at a cost; access=no and the sport's
own =no stay closed. Regenerate when brouter.de's profiles change:

  mkdir /tmp/stock && cd /tmp/stock      # one request each, never in a burst
  curl -O https://brouter.de/brouter/profiles2/hiking-mountain.brf
  curl -O https://brouter.de/brouter/profiles2/mtb.brf
  curl -O https://brouter.de/brouter/profiles2/gravel.brf
  python3 tools/make_profiles.py /tmp/stock profiles/polku-road.brf profiles

and bump the profiles' ids in js/styles.js (CUSTOM_PROFILES). Check them against the local
BRouter (tools/brouter-local.sh): with allow_private=0 every leg must route as the stock
profile does.
"""
import os
import sys

STOCK, ROAD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)


def sub(s, a, b, count=1):
    n = s.count(a)
    if n != count:
        raise SystemExit(f'{a[:60]!r}: found {n}, expected {count}')
    return s.replace(a, b)


HEAD = """# Polku: brouter.de's {stock}, plus "short cuts through ways marked private" ({name}).
# allow_private = 0 is the stock profile. With 1, ways and gates marked access=private
# (and {own}=private) may be used at a cost, so a route takes one only where it saves a
# real distance; access=no and {own}=no stay closed. OpenStreetMap's private usually means
# closed (factory and military sites, house yards, roads closed by a sign), so this is the
# user's choice, never a default (js/styles.js). Uploaded to the routing server under a
# fixed versioned id; regenerate from the stock profile if that one changes.
"""
VARS = """assign allow_private = 0 # %allow_private% | Polku: let ways marked access=private through, at a cost | boolean
"""

# ---- hiking-mountain: Hike, Run, Trail run (and Swim's land legs)
s = open(os.path.join(STOCK, 'hiking-mountain.brf')).read()
s = HEAD.format(stock='hiking-mountain', name='Hike, Run, Trail run', own='foot') + s
s = sub(s, "assign   shortest_way             0", VARS + "assign   private_penalty          0.5  # added to the cost of a way marked private, when allowed: taken where it saves about 40 % of its length\nassign   shortest_way             0")
s = sub(s, "assign defaultaccess    switch access=    not motorroad=yes    switch or access=private access=no   0   1",
        "assign defaultaccess    switch access=    not motorroad=yes    switch access=no 0 switch access=private allow_private 1")
s = sub(s, "                      switch foot=      defaultaccess    not foot=private|no|use_sidepath",
        "                      switch foot=      defaultaccess    switch foot=private allow_private not foot=no|use_sidepath")
s = sub(s, "assign accesspenalty switch footaccess 0 switch bikeaccess 4",
        "assign isprivate     and allow_private or access=private foot=private\n\nassign accesspenalty switch footaccess ( switch isprivate private_penalty 0 ) switch bikeaccess 4")
# node: a gate marked private opens when allowed, at a cost
s = sub(s, """              1 # add default barrier restrictions here!
              switch or access=private access=no
                     0
                     1""", """              1 # add default barrier restrictions here!
              switch access=no 0 switch access=private allow_private 1""")
s = sub(s, """                 switch or foot=private foot=no
                        0
                        1""", """                 switch foot=no 0 switch foot=private allow_private 1""")
s = sub(s, "assign initialcost switch or bikeaccess footaccess 0 1000000",
        "assign initialcost switch or bikeaccess footaccess ( switch and allow_private or access=private foot=private 300 0 ) 1000000")
open(os.path.join(OUT, 'polku-hike.brf'), 'w').write(s)

# ---- mtb
s = open(os.path.join(STOCK, 'mtb.brf')).read()
s = HEAD.format(stock='mtb', name='MTB', own='bicycle') + s
s = sub(s, "  assign   StrictNOBicycleaccess", "  " + VARS + "  assign   private_penalty        4 # added to the cost of a way marked private, when allowed (MTB costs run 4 to 14): taken where it saves about 40 %\n  assign   StrictNOBicycleaccess")
s = sub(s, """  assign defaultaccess =
         if access= then not motorroad=yes
         else if access=private|no then false
         else true""", """  assign defaultaccess =
         if access= then not motorroad=yes
         else if access=no then false
         else if access=private then allow_private
         else true""")
s = sub(s, """         else if bicycle= then   (  if vehicle= then defaultaccess  else not vehicle=private|no   )
                          else  not bicycle=private|no|dismount""", """         else if bicycle= then   (  if vehicle= then defaultaccess  else if vehicle=private then allow_private else not vehicle=no   )
                          else  if bicycle=private then allow_private else not bicycle=no|dismount""")
s = sub(s, """         else if foot= then defaultaccess
         else not foot=private|no

  assign accesspenalty =
         if bikeaccess then 0""", """         else if foot= then defaultaccess
         else if foot=private then allow_private
         else not foot=no

  assign isprivate = and allow_private or access=private or bicycle=private vehicle=private

  assign accesspenalty =
         if bikeaccess then ( if isprivate then private_penalty else 0 )""")
s = sub(s, """         else if ( access=private|no ) then false
         else true

  assign bikeaccess =
         if nodeaccessgranted=yes then true
         else if bicycle= then
         (
           if vehicle= then defaultaccess
           else not vehicle=private|no
         )
         else not bicycle=private|no|dismount

  assign footaccess =
         if bicycle=dismount then true
         else if foot= then defaultaccess
         else not foot=private|no""", """         else if ( access=no ) then false
         else if ( access=private ) then allow_private
         else true

  assign bikeaccess =
         if nodeaccessgranted=yes then true
         else if bicycle= then
         (
           if vehicle= then defaultaccess
           else if vehicle=private then allow_private
           else not vehicle=no
         )
         else if bicycle=private then allow_private
         else not bicycle=no|dismount

  assign footaccess =
         if bicycle=dismount then true
         else if foot= then defaultaccess
         else if foot=private then allow_private
         else not foot=no""")
s = sub(s, """              if bikeaccess then 0  else ( if footaccess then 100 else 1000000 )""",
        """              if bikeaccess then ( if and allow_private or access=private bicycle=private then 300 else 0 )  else ( if footaccess then 100 else 1000000 )""")
open(os.path.join(OUT, 'polku-mtb.brf'), 'w').write(s)

# ---- gravel (its costs multiply, so the cost of a private way is a factor)
s = open(os.path.join(STOCK, 'gravel.brf')).read()
s = HEAD.format(stock='gravel', name='Gravel', own='bicycle') + s
s = sub(s, "assign add_beeline         false", VARS + "assign private_factor 1.4 # times the cost of a way marked private, when allowed: taken where it saves about 40 % of its length\nassign add_beeline         false")
closed_way = "assign closed or access=no and access=private not allow_private\n"
s = sub(s, """assign nobikeaccess switch bicycle= switch vehicle= access=no|private vehicle=no|private bicycle=no|private|dismount
assign nofootaccess switch foot= ( and access=no|private ( not bicycle=dismount ) ) foot=no|private""",
        closed_way + """assign nobikeaccess switch bicycle= switch vehicle= closed ( or vehicle=no and vehicle=private not allow_private ) ( or bicycle=no|dismount and bicycle=private not allow_private )
assign nofootaccess switch foot= ( and closed ( not bicycle=dismount ) ) ( or foot=no and foot=private not allow_private )
assign isprivate and allow_private or access=private or bicycle=private vehicle=private""", count=2)
s = sub(s, "    multiply switch nobikeaccess 6 1\n", "    multiply switch nobikeaccess 6 1\n    multiply switch isprivate private_factor 1\n")
s = sub(s, "    switch    and nobikeaccess nofootaccess    1000000\n", "    switch    and nobikeaccess nofootaccess    1000000\n    switch    isprivate                        300\n")
open(os.path.join(OUT, 'polku-gravel.brf'), 'w').write(s)

# ---- road: Polku's own road profile (unpaved_mainroad_factor) plus allow_private
s = open(ROAD).read()
s = sub(s, "# Polku road cycling: brouter.de's fastbike-lowtraffic, plus one variable.",
        "# Polku road cycling with short cuts: profiles/polku-road.brf (brouter.de's fastbike-lowtraffic\n# plus unpaved_mainroad_factor), plus allow_private, as in profiles/polku-hike.brf.\n# allow_private = 0 is polku-road.brf.\n#\n# polku-road.brf: brouter.de's fastbike-lowtraffic, plus one variable.")
s = sub(s, "assign consider_traffic = true", VARS + "assign private_penalty = 0.5 # added to the cost of a way marked private, when allowed: taken where it saves about 40 % of its length\nassign consider_traffic = true")
s = sub(s, """              switch or access=private access=no
                     false
                     true""", """              switch access=no false switch access=private allow_private true""")
s = sub(s, """                        not vehicle=private|no
              not or bicycle=private or bicycle=no or bicycle=dismount bicycle=use_sidepath""", """                        switch vehicle=private allow_private not vehicle=no
              switch bicycle=private allow_private not or bicycle=no or bicycle=dismount bicycle=use_sidepath""")
s = sub(s, """                 not or foot=private or foot=no foot=use_sidepath""", """                 switch foot=private allow_private not or foot=no foot=use_sidepath""")
s = sub(s, """assign accesspenalty
       switch bikeaccess
              0""", """assign isprivate and allow_private or access=private or bicycle=private vehicle=private

assign accesspenalty
       switch bikeaccess
              switch isprivate private_penalty 0""")
# node
s = sub(s, """              1 # add default barrier restrictions here!
              switch or access=private access=no
                     0
                     1""", """              1 # add default barrier restrictions here!
              switch access=no 0 switch access=private allow_private 1""")
s = sub(s, """                        switch or vehicle=private vehicle=no
                               0
                               1
                 switch or bicycle=private or bicycle=no bicycle=dismount
                        0
                        1""", """                        switch vehicle=no 0 switch vehicle=private allow_private 1
                 switch or bicycle=no bicycle=dismount 0 switch bicycle=private allow_private 1""")
s = sub(s, """                 switch or foot=private foot=no
                        0
                        1""", """                 switch foot=no 0 switch foot=private allow_private 1""")
s = sub(s, """       switch bikeaccess
              0
              switch footaccess
                     300
                     1000000""", """       switch bikeaccess
              switch and allow_private or access=private bicycle=private 300 0
              switch footaccess
                     300
                     1000000""")
open(os.path.join(OUT, 'polku-road-shortcuts.brf'), 'w').write(s)
print('written:', sorted(os.listdir(OUT)))
