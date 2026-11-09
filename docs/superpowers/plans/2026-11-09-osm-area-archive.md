# Area geometry archive implementation plan

> Execute this plan in the isolated geometry checkout with Superpowers executing-plans, then verify the candidate before any publication.

**Goal.** Serve lake, park and protected-area picks from the existing local geometry format within the standard runner budget.

**Evidence.** The full geometry recovery reached 2,174,000 of 8,187,243 roots in 240 minutes, including 63 minutes after node indexing started and before tiling. The original Estonia catalog has 399,069 roots, of which 39,765 are areas. Existing hosted ways and inspection archives already contain exact supported tags. Ambiguous nearby relations still use the existing bounded fallback when their member geometry is needed.

**Constraints.** Preserve original tags and IDs, area containment, topology, border reference completion, signed-off coverage polygons and failure states. Use the existing dated Europe input and country digests. Keep the 28 country products and release jobs independent. No new infrastructure or dependencies.

1. In `tools/osm_data/test_geometry_source.py`, pin the area-only root subset, rejection of conflicting duplicate purposes/digests, and `nearby_complete:false` in a verified combined candidate. Source references and area completeness are still mandatory.
2. In `geometry_source.py`, stream the existing sorted root catalogs and keep supported area roots only. Reuse the native compiler. Report `nearby_complete:false` explicitly because the candidate does not cover general nearby searches. Preserve complete area evidence and the manifest flag type checks in `bundle.py`. In `measure_browser.py`, verify areas in the archive, leaving generic inspection verification with its existing dataset.
3. With the corrected weekly workflow, isolate the read-only `geometry-candidate` operation from the production concurrency group. Verify the retained artifacts and build one candidate for all four countries. Record actual job time, disk, RSS, archive bytes, browser transfer and latency. If an area lacks the evidence to certify absence, fail the candidate rather than changing the coverage claim.
4. Adapt #778 to use the candidate for area picks and reuse the selected original tags. Keep other inspection on its existing hosted sources with one hosted budget and the existing mirror round. Keep explicit complete-empty, incomplete, failure, border and worker-offline cases. Test on current main using all four countries.
5. Enable recurring area builds only after the full candidate and monitoring fit the measured limits. Publish with the existing gates, verify live app and data and record the result in #696 and #154.
