# proj-ta-apply: Initial Design

Please examine the source code of:

* https://github.com/ucsb-cs156/proj-frontiers
* https://github.com/ucsb-cs156/proj-scaffold
* https://github.com/ucsb-cs156/proj-citelines
* https://github.com/ucsb-cs156/proj-dining
* https://github.com/ucsb-cs156/proj-courses

for various conventions including:

* Spring Boot Backend
* React Frontend
* Use of Swagger for backend API documentation and testing
* Use of github actions workflows for a CI/CD pipeline
* Dockerfile for configuring app for Dokku
* settings in pom.xml and application.properties for multiple profiles for localhost, end to end integration testing, and production on dokku.
* settings in pom.xml and application.properties for connecting with Postgres and MongoDB, with integrated H2 and Mongo DBs for local development, and real dbs for production
* settings in pom.xml and package.json for using Jacoco and Pitest for backend testing coverage/mutation testing, and Stryker-js for frontend mutation testing.

Then, please set up an app with the following features, most of which are present in at least one of the apps already mentioned above, or are very small variations on those.

* Login with Google OAuth

* Roles: Admin, Instructor, Grad Student (note that this is the first app with two roles that are "more than user, but less than admin", but the pattern generalizes).
Admins should be able to set up users as Instructors or Grad Students by entering their emails.

* One extra feature not in any of the current apps: the ability to upload a list of emails from a file and have each of those emails be entered into the table of grad student users.

There will be many more features added in future iterations, but for the first iteration, let's just keep it to this.

# Second Iteration

As an admin I can specify a range of quarters, and a level, and the system will populate a table with all of the courses numbers from "CMPSC" (a subject area configured via application.properties) that have been offered over that range of quarters.

These will be obtained from api.ucsb.edu in the same way as proj-courses.

We are only looking for the course numbers and names here, not the particular of the offerings.

Those will be presented to me in a table.

There will be a way for the admin to click a checkbox (or unclick it) to indicate which courses should get TAs assigned, and a separate checkbox to indicate which courses should get ULAs assigned.

# Third Iteration

For the third iteration, we want to add the idea of a Recruitment.

Admins will have the ability to create a recruitment.

There will be a database table for recruitments, which will store the following fields:

* Quarter (in YYYYQ format, but displayed in QYY format)
* Type (either TA or ULA)
* Application Status: Open or Closed (starts closed, and set manually)
* Tentative Opening Date (required; used to inform users)
* Actual Opening Date (recorded automatically when applications are first opened)
* Primary Consideration Date (required; used to inform users)
* Actual Closing Date (recorded automatically when applications are closed)

Note that we may build features for automatically opening and closing recruitments in the future, but for the mininmum viable product, we are keeping it simple, and making opening and closing the applications manual.

Designing a protocol for opening and closing automatically that also allows manual override is complicated.

Once a recruitment is created, a job will be launched that fills a table of "RecruitmentCourses" with only the courses that are (a) in the Courses table and that recruit for TA or ULAs and (b) are offered during the upcoming quarter.

There should be a button the Admin can click to populate this table, as well as a button to remove any rows from the table if TA or ULAs should not be included in the recruitment for that quarter.  

Each field in the RecruitmentCourses table will have:

* id
* recruitmentId
* courseId (e.g. `CMPSC     1A`, `CMPSC   130A`)
* instructor
* day(s) (first one, for primary only)
* time(s) (first one, for primary only)
* room
* enrollment
* max enroll
* status (i.e. open, closed, cancelled, etc.)
* summer session (only shown for summer session courses, but column is always present)


The Admin should have an Admin/Recruitment menu, and the recruitments should then appear in a table with the default sort order being most recent first, and least recent last.  There should be a button in each row of that table called "Courses" that takes the Admin to a page:

`/admin/recruitments/:recruitmentId/courses`

that shows a table of the Recruitment Courses.  

This table should be sorted by course id in the same way as Admin/Courses is sorted.

# Fourth iteration

There will be a way for TAs and/or ULAs to enter an application when applications are open.

Users that are Grad Students will be able to apply for TA positions when there is an open recruitment. Users that are undergrads will be able to apply for ULA positions when there is an open recruitment.

The home page for should indicate all of the following:
* If there are no currently open recruitments (of the appropriate type), it should indicate "Applications for TA (or ULA) positions are not currently being accepted".
* If there are any open recruitments of the appropriate type, there should be a link to create an application.
* If there are any past recruitments of the appropriate type that have closed, when the most recent recruitment opened and closed.
* For each recruitments that has been created but hasn't opened yet, when the tentative opening date is.

There should also be a table of all applications that the student has ever created, along with the status: e.g. pending, hired, not-hired.

If the application is for an open recruitment, and the deadline has not yet passed, grad students and undergrads should be allowed to edit their application.

Once the deadline has passed, they shoudl be able to update only a "post application comments" field that is
edited separately from the rest of the application.

When creating an application, by default, all relevant fields from the most recent application should be copied over.

The information that the app should gather about each applicant includes the following.

Some fields are common to both TA and ULA applications, others are specific, as noted below.

| Field | TA only | ULA only |
| email (primary key) | |
| first_name | | 	
| last_name	| | 
| middle_name	| | 
| residency_status	(US Citizen, US Resident, F1 Student Visa, J1 Student Visa, other) | * | |
| language_exam	(passed or failed, but only if F1 or J1 Student Visa, otherwise "exempt" | * | | 
| language_exam_date_passed	| * | | 
| major	| | | 
| gpa_major	| | | 
| gpa_overall | | | 
| class_level (Phd or MS) | * | | 
| year_in_program	| | | 
| graduation_date | | | 
| coursework_ucsb | | |  
| coursework_other | * | | 
| coursework_290 | * | | 	
| knowledge	| | | 
| prev_experience | | | 	 
| desired_courses | | | 
| comments | | | 
| video_link | | * |
| previous_service_as_ula (number of times) | | * |
| first_choice_course | | |
| second_choice_course | | |
| available_for_lectures_first_choice_course | | |
| available_for_lectures_second_choice_course | | |
| available_for_at_least_one_discussion_first_choice_course | | |
| available_for_at_least_one_discussion_first_choice_course | | |
