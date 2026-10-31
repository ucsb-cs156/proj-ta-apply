# proj-ta-apply Assignment phase design

* The InitialDesign.md document only dealt with the design of the application process.
* The ReviewDesign.md document dealt with the phase where faculty review and rank applications.
  
We now need to consider the Assignment Phase, where admins assign candidates to 
positions based on faculty rankings, and the need to cover all of the courses.

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







