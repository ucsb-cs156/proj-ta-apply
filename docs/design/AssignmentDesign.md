# proj-ta-apply Assignment phase design

* The InitialDesign.md document only dealt with the design of the application process.
* The ReviewDesign.md document dealt with the phase where faculty review and rank applications.
  
We now need to consider the Assignment Phase, where admins assign candidates to 
positions based on faculty rankings, and the need to cover all of the courses.

Since part of this involves money, let's make an initial blanket statement
that all quantities that are dollar amounts should be formatted as dollar amounts,
hown as dollar amounts with dollars and two decimal places for cents.

# Increment 1: Ability for Admin to assign target numbers to hire.

There should be a field on the recruitment database record called "totalHiringTarget".

This is the total number of either TAs or ULAs that are expected to be hired.

Label it as "Total number of TAs (or ULAs) expected to be hired: "

Change the label based on whether this is TA or ULA recruitment.

Value should be an integer > 0.  Default value is 1.

Allow the admin to update this field at the top of the RecruitmentCourses page.
It will not be visible anywhere else, for now.

Update the database should update as soon as the admin enters or edits the number to another valid value.  If the admin leaves the page with an invalid value,
the old stored value in the database should "come back".

Then, for each course, there should be a field where the admin can enter "allocation", the number of TAs (or ULAs) allocated to be
hired for that course.

As soon as each number is entered, update the RecruitmentCourse table with the number.

Finally, at the top of the recruitment page, just under the place where the admin updates the "Total number of TAs (or ULAs) to be hired",
there should be a read only display of the number allocated so far (a total of the hiring targets for each course), 
and the number of "TA/ULA allocations left to assign". Those two numbers should add up to the target number of TAs to hire.

The number "left to assign" can be negative; in this case, put a message saying that "Please either increase the hiring target,
or reduce the allocations for one more courses".   

The intent is to help guide the Admin make an allocation that adds up to the number in the hiring target.

These changes to the database do not require an audit trail.

# Increment 2: Ability to add enrollment estimates

When bringing up the Recruitment Course page, make a call to the UCSB API for each course and update the data for the course; the main purpose of this 
is to have updated values for maxEnroll and enrollment.

Add a field to the Recruitment Course called "enrollmentEstimate".  

On the RecruitmentCourse view for the admins, make this field an integer that can be entered by the Admin.  Data values should be saved within 1-2 seconds
of any change to any of the values.   

There should be a two buttons with the labels "max" and "actual", and they should come after the label text: "Set enrollment estimate from: "
so that it reads, left to right, as "Set enrollment estimates from: [max](#), [actual](#)." 

These buttons will load the enrollment estimates from either the maxEnroll or enrollment fields, respectively.

These changes to the database do not require an audit trail.

# Increment 3: Ability to automatically assign TAs allocations based on enrollment estimates.

Add, to the bottom of the RecruitmentTable, a totals row that shows the totals of "estimatedEnrollment", "maxEnroll" and "enrollment",
and under the list of course names, "Total Course Count: n" where n is the total number of courses.

Add a field to the RecruitmentCourse table called "unroundedAllocation" that is computed as follows, and updated each time a change is made to either the 
(1) totalHiringTarget, or (2) enrollmentEstimate of any course:

unroundedAllocation = hiringTarget * (estimatedEnrollment / totalEstimatedEnrollment )

Put a tooltip that explains: unroundedAllocation is how many TAs the course would receive if TAs could be divided into "fractional bits", and were 
divided based only on estimatedEnrollment.  In reality, one must round up or round down, but this number provides a guide for approaching a fair allocation.

Calculate this as a double, but display it with only one decimal place after the decimal point.  
Always show this, so it is an integer value 1, it shows as 1.0.

Also display a field called allocationDelta that is calculated (no need to store it separately) that shows the difference between the unroundedAllocation and the current
allocation.  This is also a floating point number, displayed with just one decimal point. 
Display positive numbers in green with an actual plus sign in front of them.  Display the number 0.0 (including non zero values that round to 0.0),
in black.  Display negative numbers in red.

Finally, display a field that shows the estimated TA:student ratio.  Stack this column heading so it's not too wide. Display the values
in the format "1:n" where n is the estimatedEnrollment divided by the allocation.

Then, have a button that says: "Auto assign TA allocations".  This button should have a tooltip that says: 

"Automatically allocate the ${totalHiringTarget} TAs (or ULAs) across courses based on enrollment".

This button should bring up a modal that says: 

> You have requested an automatic allocation based on estimated enrollment.
>
> This will overwrite all values currently in the allocation fields.
> This cannot be undone.
> 
> Are you sure?

Then the two buttons should say: "Yes, overwrite allocations" and "No, keep my current allocations".

If the button is pressed, use this heuristic to come up with a best effort allocation:

1. First, assign every course an allocation by rounding up or rounding down to the nearest integer.
2. Next, if the total number allocated is higher than the totalHiringTarget, find the course with the
   maximum value over all allocationDeltas, and reduce it's allocation by one.  Repeat this process until
   the allocation reaches the totalHiringTarget.

   If the total number allocated is less then that totalHiringTarget, use the dual of this approach;
   that is, find the course with the minimum value among all allocationDeltas, and increase that courses
   allocation by one.  Repeat this process until the allocation reaches the totalHiringTarget.
3. Then return to the page, showing the new allocation targets.

The help pages should explain that the purpose of this features is to give Admins a way to make a first cut
allocation that is based on enrollment, to try to come as close as possible, but that this should not necessarily
be considered the final allocation; Admins have the flexibility to adjust this initial allocation up or down based on a number of factors, 
including the particular needs of specific courses, and other relevant factors.

# Increment 4: Budget Screen

Add a new item to the Admin menu called "Budget for Quarter"

Also add a new database table called "Budget" where the primary key is a quarter code such as "F26".

The "Admin/Budget for Quarter" page brings up a page where the admin is first shown a page /admin/budget/selectQuarter, where they are shown 
a list of quarters for which recruitments are available.  First column is the name of a quarter (e.g. F26), and is a link to the page:
/admin/budget/{qxx} (where qxx is the quarter code, e.g. F26).  The second column is labelled TA and the third column is labelled ULA, and shows an x if there is a recruitment of that type for that quarter.  The table should be sorted from most recent quarter, to least recent quarter.

When the admin navigates to the /admin/budget/{qxx} page, they can enter/update values for the following, which are new database fields to be added to the budget table:

(1) avgCostPerTA: Total estimated average cost in dollars and cents per TA (store this on the TA recruitment; grey out if there is not TA recruitment for that quarter)
(2) avgCostPerULA: Total estimated average cost in dollars and cents per ULA (store this on the ULA recruitment; grey out if there is not TA recruitment for that quarter)
(3) unrestrictedBudget: Total estimated "unrestricted" budget in dollars and cents (to be allocated among TAs and ULAs)
(4) tasOnlyBudget: Total estimated additional "TAs only" budget in dollars and cents (to be used for TAs only)
(5) ulasOnlyBudget: Total estimated additional "ULAs only" budget in dollars and cents (to be used for ULAs only)

Make notes that these three budget lines may include both subzero and/or gift money, and that any of them might be zero in a given quarter.  The idea is that for budgeting purposes, restricted money is spent first, then any additional expense is paid for from the shared pool.  This should be explain *very concisely* directly on the page, with a direct deep link to a longer explanation in the Admin Help pages.

Then, show the totalHiringTarget fields for TAs and ULAs for this recruitment, and make them editable fields.  This allows the admin to adjust the budget in one place, holistically.    Show the total allocations for TAs and ULAs as well, and the differences, and highlight this when the two numbers are not equal, with a message that this will need to be adjusted on the RecruitmentCourses page, and offer deep link(s) to those page(s).

Also show the total estimated enrollment for all of the recruitment courses for TAs and all recruitment courses for ULAs (noting that these may be different, since the two recruitments may cover different courses.)

Show the overall TA:student and ULA:student ratios.

Then, show a section called "Budget".  All amounts here should be shown as dollar amounts with dollars and two decimal places for cents.

On the Expenses side, show all of these, formatted as dollar amounts rounded to whole dollars:

* Row 1: Total anticipated cost for TAs (i.e. totalHiringTarget(TAs) * avgCostPerTA
* Row 2: Total anticipated cost for ULAs (i.e. totalHiringTarget(ULAs) * avgCostPerULA
* Row 3: is deliberately blank
* Row 4: Total anticipated expenses: sum of those two lines

Then, on the Funds side show:

* Row 1: tasOnlyBudget
* Row 2: ulasOnlyBudget
* Row 3: unrestrictedBudget
* Row 4: Total anticipated funds: sum of previous three lines

Then show bottom line: either in red with a minus sign if it is negative, zero in black if it is zero, and green with a + sign, i.e, total funds minus total expenses.

As the Admin updates the inputs to this, the numbers should update in the database immediately, and update the entire display.

These changes to the database do not require an audit trail, since they are for planning purposes only.


# Increment 5: Allow Admin to show or hide allocations on faculty facing pages

Give the admin an option at the top of the RecruitmentCourses page for a recruitment to "Show" or "Hide" the allocations
of TAs and ULAs on the faculty facing pages for the recruitment.

The default is that the allocations are hidden, and the button says: "Show".

The UX element should say either this:

"Allocations of TAs/ULAs per course are currently hidden from faculty."
then the button says: [Show Allocations to Faculty]

OR:

"Allocations of TAs/ULAs per course are currently shown to faculty (though only for their own courses)"
then the button says: [Hide Allocations from Faculty]

When showing the allocations is enabled:

* On the home page, next to each course, include a user interface element that shows the faculty how many TAs or ULAs are allocated to their course
* Also show this allocation at the top of the ranking page. Note that faculty should to rank at least as many candidates as this target, but preferably twice as many.


# Increment 6: Make an assignment page

Add a button to the Admins button panel on the home page under each recruitment called "Assignments"

The starting point for this page is to simply display, in table format, the fields in the CSV file that
is currently part of the application where the admin can download faculty rankings.

Here are the additional features that are needed:

(1) The ability to sort by any column.  When sorting by the columns for the various courses, sort the rankings that are non-empty at the top, followed by all of the empty ones.

(2) The header cell for each course should actually have three values in rows that do not move under it: the total allocation for the course, and the number assigned so far (initially zero), and the number left to assign (which could be negative if the admin has assigned more than the allocation).

(3) There should be a column just to the left of all of the columns for the various courses that has a dropdown in each row for all of the RecruitmentCourses.  The default is blank (for a null value) and all of the other values are the courses in the recruitment.
This field is "tentativeAssignment" and should be stored on the Application row in the database, but NOT yet shown to the student.  It will be shown to the student only at a later stage in the process, when the Admin is ready to move forward from tentative assignments to actual assignments.  It should also NOT be visible to faculty at this stage, only admins.

As tentativeAssignments are made, the values at the top of each course column should update.

Once these features are in place, the CSV download should be modified to include these extra rows and columns.




