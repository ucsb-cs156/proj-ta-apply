# Recruitment Steps diagram (design artefacts)

`recruitment-steps-ta.svg` and `recruitment-steps-ula.svg` are the agreed layout of the
Recruitment Steps diagram described in `../AdminUserInterfaceDesign.md`. They were produced by
`make_steps_svg.py` (run `python3 make_steps_svg.py <output dir>`), which lays the nine steps out
from a table of labels and edges.

They are the specification for the React component that draws the diagram in the app; the
component's tests should produce the same boxes, edges and labels. They are not served by the app.
