"""Complete the four-country geometry roots from one same-epoch reference source."""
from pathlib import Path
import osmium


def reference_subset(source, roots, output):
    tracker = osmium.IdTracker()
    for kind,ref in roots:
        getattr(tracker,'add_'+kind)(ref)
    # Depth zero does not even follow seeded root relations' direct members.
    tracker.complete_backward_references(str(source),relation_depth=10)
    with osmium.io.Reader(str(source)) as reader:
        header = reader.header()
    with osmium.SimpleWriter(str(output),header=header) as writer:
        for obj in osmium.FileProcessor(str(source)).with_filter(tracker.id_filter()):
            writer.add(obj)
    return tracker
