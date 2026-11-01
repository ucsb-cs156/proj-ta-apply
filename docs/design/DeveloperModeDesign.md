# ta-apply: Developer Mode Design Document

In this epic, we design a number of features to assist developers and application testers
to populate various parts of the app with fake data, in order to better test the app without
having to go through a full cycle of actual data entry.

The idea is that a developer or admin can turn on "development mode" for any 
deployment that has ENABLE_DEVELOPER_MODE=true.   Turning on this environment variable
provides an extra feature on the Developer Menu to enable or disable developer mode.

When Developer Mode is enabled, a "Developer Mode" badge appears prominently 
in the footer, flush right.  And then, to the right of this, there can be page
specific features and controls for enabling quick set up of test data so that
the various features of the app can be explored.

