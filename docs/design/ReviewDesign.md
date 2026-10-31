# proj-ta-apply review phase design

The InitialDesign.md document only dealt with the design of the application process.

We now need to consider the Review Phase.

# First Iteration

Add to the Recruitment an additional String field:

* reviewStatus.  Values are "NotStarted", "Open", "Closed".  The initial value and default value is "NotStarted".

Put this field on the Admin and Instructors views (but not on the student's view).

Give the Admin a button to "Open Faculty Reviews" if the value is NotStarted or Closed, and a button to "Close Faculty Reviews" if the current status is
Open.

When the admin opens faculty reviews, a modal should pop up where the admin must enter a deadline for the faculty to enter their preferences.
The first date the review was opened should be recorded in the recruitment entity and preserved when reviews are reopened. Every opening or reopening requires a facultyRankingDeadline; admins can edit that deadline later. Both fields are LocalDates, and changes to the status and deadline are recorded in the recruitment audit trail.

Show both on the header of the recruitment for Admins and Faculty.

Record changes to the reviewStatus in the RecruitmentAuditTrail table, as well as recording changes to the facultyRankingDeadline.

On the Admins view of the recruitment, provide a button next to the facultyRankingDeadline where the admin can change the date.


# Second Iteration

When the faculty reviews are Open for a recruitment, provide a button on each of the rows that shows a course on the Instructor section of the home page 
under that recruitment that says "Rank Candidates".

When the faculty reviews are closed for a recruitment, provide a button on each of the rows that says: "View Candidate Rankings".

For now, each of these buttons should go to a specific page that is scoped by the recruitment and the course, but that page should, for now,
only show, at the top of the page, a heading that says "Candidate Ranking" and under that, information about the recruitment (including the date that
the rankings were opened, and the facultyRankingDeadline) and information about the course.

If the faculty member has multiple courses associated with the recruitment, near the top of the page, provide direct links to this with a header that says:
"Your other ${quarter} Courses" where "${quarter}" is filled in with the quarter of the recruitment.

Then, there should be a message that says: "Coming soon on this page: a table to rank the candidates for (TA/ULA) for this course" (filled in with the 
appropriate type of the recruitment).

# Third Iteration

When the faculty ranking page is shown, it should have a table of all of the applications that included this course as either first choice,
second choice, enthusiastic, or would consider.

List the applications in a table with that as the second column, with those values "1st Choice", "2nd Choice", "Enthusiastic" and "Would Consider".

When sorting by that column, treat 1st Choice < 2nd Choice < Enthusiastic < Would Consider as far as sorting goes.

Also allow sorting by other fields.

The first column should be a ranking column, where the instructor can enter any number from 1 to the number of applicants. Entered data should be *immediately saved*.

Ties should be allowed, but, after a 2 second delay, flagged in a background color (bright yellow).  A message should appear that says: 

> You have tied rankings.  This is permitted, but please be *absolutely* sure that you really do have zero preference between the candidates you have given the same ranking.  Rankings without ties make it easier to finalize assignments.

The message and highlighting should disappear if/when ties are removed.

The other fields visible to the instructor should be these, in this order, all sortable.

For TA applications:

* first name
* last name
* email
* major
* level (PhD or MS)
* year in program
* expected graduation



For ULA applications: 

* first name
* last name
* email
* major
* year in program
* expected graduation
* gpa in major
* overall gpa
* quarters of previous ULA service
* video link

For both: The first name and last name should be clickable links, and should take the faculty member to a read only page where they can see the entire application for the student. It is best if this comes up in a new tab/new window so that they faculty member doesn't lose their place on the rankings page.

# Fourth Iteration

For the admin, on the Courses page, once the RankingStatus is no longer NotStarted, show a column all the way at the left of the current page that has the heading "Rankings" and the contents are the count of the number of rankings that have been entered for that course.

The numbers should be a hyperlink to the page showing the rankings (or the lack thereof when the number is zero).

This column should be sortable, so that the Admin can identify which instructors have and have not done the rankings.

Also, between instructor and days, add an email column.  Each email address should have the "copy" widget beside it that copies that email address so that it can be pasted into an email.

Finally, have a button that says: "Copy emails of faculty with zero rankings".   Clicking this will copy those emails, one per line, into the paste buffer, suitable for pasting into an email program so that a reminder can be sent. 

# Fifth Iteration

Allow the Admin to download the Rankings in a CSV that has these columns:

For TAs:

* first name
* last name
* email
* major
* level (PhD or MS)
* year in program
* expected graduation

then, a column for each course, and in that course, the rankings for that course.

For ULAs: 

* first name
* last name
* email
* major
* year in program
* expected graduation
* gpa in major
* overall gpa
* quarters of previous ULA service

then, a column for each course, and in that course, the rankings for that course.
