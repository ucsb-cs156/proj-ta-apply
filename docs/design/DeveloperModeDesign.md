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

All of the features for coming up with fake data and populating the various parts of the
database should be isolated in their own services so that:
* The impact on the production code is minimal. It can't be zero, but it really should be minimized.
* As much as possible, the components for creating fake data can be reused in other scenarios (e.g. the code for creating a fake but plausible list of a courses taken by a grad student or an undergrad student.)


# Iteration 1: Enable Developer Mode

In this iteration, we:

* add the ENABLE_DEVELOPER_MODE to the .env.SAMPLE, the documentation about setting up environment
variables on dokku. The default is false, and the value should be set to true only on test instances.  However, for localhost, in .env.SAMPLE, the value should typically be set to true.
* when ENABLE_DEVELOPER_MODE is true, the Developer menu should include the ability to toggle the Developer Mode setting between on and off.   The current value should be stored in a database table called GlobalSettings, with two fields: "key" and "value".   The key in this case is developerMode, and the value is a string "On" or "Off".   This is not the same as the ENABLE_DEVELOPER_MODE setting; that determines whether developerMode is available at all.  Rather the current value of developerMode is whether it it currently turned on or off.
* When developerMode is On, show a red badge in the footer that says "Developer Mode".

So far, this iteration just makes it possible to turn developer mode on and off, but it doesn't do anything useful yet.

# Iteration 2: Admins on Home Page can auto create Recruitments

When developerMode is on, on the home page, Admins see a "Auto Create Recruitments".   When clicked, this button will:

* First do some calculations to determine what can/should be auto-created; see below for details.
* Bring up a modal with a plan to auto create these recruitments.
* Offer the admin a choice to proceed, or cancel.

Here are the rules for populating the auto-create:
* Determine the quarter that follows the current quarter, skipping summer quarter.  This will be the quarter for the recruitment that is to be created.   There should be a quarter selector that allows the Admin to select a different quarter, if desired.
* If there is already a recruitment for that quarter for TAs, skip creating one for TAs.
* If there is already a recruitment for that quarter for ULAs, skip creating one for ULAs.
* If there is then nothing to be created, state so, and the only option offered to the Admin is "Cancel".
* Otherwise, determine a date that is one week from today's date as the "Tentative Opening" date. 
* Determine a date that is one week after the "Tentative Opening Date" as the "Primary Consideration Date"
* Indicate that when the button "Create Recruitments" is clicked, recruitments, for TAs, or ULAs, or both (indicate specifically what will happen), will be automatically created.

Implement the autocreation when the button is clicked.

# Iteration 3: Admins can populate recruitments

When the developerMode is on, and an Admin is on the admin/recruitments/:id/applications page,
there will be a button on the footer [Create Fake Applications]

When pressed, this button will bring up a modal with these choices:

* An integer field for number of fake applications to create, default value: number of courses * 2, which is also the minimum.  Maximum is number of courses * 10.
* A radio button with two choices:
  - () Cover all courses with a reasonable number of applicants
  - () Leave some courses with few or no applicants

And then buttons to [Create Fake Applications] or [Cancel].

If the button to create fake applications is pressed, launch a job to create the fake data.  Show a new modal that indicates "Fake applications are being entered; see [link to jobs page] for details.  Refresh the page a few times, and they should all appear".  

This modal will have a cancel button.

Here's what the job should do:

* Create fake applications with plausible, but fake names.  Make "Fakedata" the middle name of each applicant.
* The email addresses should be plausible ones to match the names, but the email address host should be @fake.ucsb.edu
* All other data should be reasonable values, but fake ones.
* For the first option: "Cover all courses with a reasonable number of applicants", spread out first choice, second choice, and Enthusiastic so that each course has at least one applicant; then assign randomly for all other choices, where 1st choice course is a uniform distribution, 2nd choice course is a uniform distribution including "no second choice" and excluding the 1st choice course selected.
* For the second option, select at least one course to have zero applicants, and at least one course with only 3 applicants, one of whom is Enthusiastic, and the other two are Would Consider.  Then populate the rest of the course ratings using the random assignment rules above.
* Then, enter random data for the courses already taken, but data that is plausible.  That is, when selecting which courses a student has taken, consider the pre-requisite relationships in https://github.com/ucsb-cs156/proj-ta-apply/blob/main/src/main/resources/data/cmpsc_prereqs.json.
* For ULA applications, first choose a year for the student (e.g. 1, 2, 3, 4) uniformly, then if n in the year of the student, choose numberOfCourses courses, where `numberOfCourses = 6 * (n-1) + random.nextInt(1, 7);`.   Start at the bottom of the pre-requisite graph, with either 8 or 16 as the starting point, and then walk the graph forward choosing courses randomly at the frontier of a breadth-first-traversal of the graph.  For term, walk the quarters back from the current one, to choose plausible quarters for each course.  Select grades randomly from among B- through A+.
* For TA applications, choose first randomly among US Citizen, US Permanent Resident, F1 Student Visa, J1 Student Visa. Then, for both of the US options, flip a coin between UCSB and Other.  If UCSB, choose undergrad courses the same way you would choose courses for a 4th year ULA applicant, and fill in courses for the applicant.  If "Other", consult the file other_undergrad_courses.json and populate the list with 10 courses from a random domestic school.  For the F1 and J1 visa, choose among the international schools listed in other_undergrad_courses.json and populate the list with 10 courses from the selected school.  For term, walk the quarters back from the current one, to choose plausible quarters for each course. Select grades randomly from among B- through A+.   Then, consult https://github.com/ucsb-cs156/proj-ta-apply/blob/main/src/main/resources/data/cmpsc_prereqs.json and select 5 random grad courses (any with numbers 200 or higher), and add those to this list of courses taken, with plausible terms and grades.
* Fill out other fields with random, but plausible values. For free text fields, if there is a reliable open source compact LLM module for Java that can generate text for comment fields at run time, etc. use it, and incorporate into the project and give it a reasonable prompt; otherwise, just generate a few fixtures for plausible comments at coding time, and randomly select among these.
* If there are fields where you are not sure how to fill them in, ask follow up questions when working on the issue.
* Finally, there is an existing field on the application to mark fake data. Please modify the name of this field if needed, and the values stored in it to make it clear that there are now three kinds of applications: "real ones entered by a real applicant", "fake ones entered as a test by the admin", "fake ones populated by the automatic developerMode feature".  Come up with a short name for each of these, and populate the field with those values (maybe an enum?)  Please add a badge to the top of the application forms that distinguishes between fake applications entered by a human Admin, and those created by the developerMode in some way (different text on badge, or different color, or both).  Regular applications should not have the badge at all.
* Currently, it may be the case that at later stages, e.g. ranking applicants, hiring, etc. that fake applications are excluded.  That should still be the case in most circumstances.  But not when developerMode is on; in this case, treat all applications as valid ones so that we can test all of the features of the app.  Note that developerMode should NOT be enabled in production; only for testing.

