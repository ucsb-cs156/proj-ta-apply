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
The date the review was opened should be recorded in the recruitment entity (add a field for this, and add a field for the facultyRankingDeadline.)

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

List the applications with that as the first column, with those values "1st Choice", "2nd Choice", "Enthusiastic" and "Would Consider".

When sorting by that column, treat 1st Choice < 2nd Choice < Enthusiastic < Would Consider as far as sorting goes.

Also allow sorting by other fields.

The other fields visible to the instructor should be these, in this order, all sortable.

For TA applications:

* first name
* last name
* email
* major
* level (PhD or MS)
  
