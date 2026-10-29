const csvFixtures = {
  instructorEmails: `name,email
Chris Gaucho,cgaucho@ucsb.edu
Lauren Del Playa,ldelplaya@ucsb.edu`,
  /** What a majors or topics list downloads as, and what its upload accepts. */
  settingsNames: `"name"
"Computer Engineering"
"Computer Science"
"Statistics and Data Science"`,
  /** The upload is lenient: unquoted, extra columns, any header case. */
  settingsNamesLenient: `id,Name
1,Compilers
2,Web Development`,
  /** The ULA Google Form's response sheet with the condensed headers, a few columns, one fake row. */
  legacyUlaResponses: `Timestamp,Email Address,First name,Last name,Perm number,Expected graduation date,BS/MS student?,Other Campus Job?,Prior UCSB employment?,Previous LA Service for CS,Agree to statement,Course Preferences [8   (Kharitonova Y)],Course Preferences [24   (Mirza D)],First Choice,Second Choice,Lectures: first choice,Sections: first choice,Availability Comments,GPA,Major,Rate your familiarity with each of these platforms [Git/GitHub],Activity Interests [Exploring teaching as a career option],Video Link
5/9/2026 13:45:12,ada.lovelace@ucsb.edu,Ada,Lovelace,A1B2C3D,S27,No,No,Yes,0,I AGREE to this commitment.,1-Enthusiastic,2-Would Consider,8   (Kharitonova Y),24   (Mirza D),Both lectures per week,Yes,,3.8,CMPSC (Computer Science),1-Very comfortable,4,https://youtu.be/dQw4w9WgXcQ`,
  /** The first columns of the legacy TA application's export, with one (fake) row. */
  legacyTaApplications: `date_modified,first_name,last_name,middle_name,email,residency_status,language_exam,language_exam_date_passed,major,gpa_major,gpa_overall,class_level,year_in_program,graduation_date,coursework_ucsb,coursework_other,coursework_290,knowledge,prev_experience,desired_courses_grad,desired_courses_upper,desired_courses_lower,comments_applicant,comments_reviewer,preferred_job,preferred_hours,date_submitted,modified_by,application_quarter,must_hire
2025-11-20 10:00:00,Ada,Lovelace,Fakedata,ada.lovelace@ucsb.edu,F1 (Student) Visa,passed (F1 or J1 visa),Fall 2024,CS,3.9,3.8,PHD,2,06/2027,"130A:A,16:IP","Intro to C:De Anza College:16","CMPSC 291A - Neural Information Retrieval:Dagny Sandoval-Rey:A+","C++:3,Python:5","130A:TA:Fall 2024",,"111,156","8,16",Happy to help anywhere.,,TA Only,20,2025-11-01 09:00:00,admin,W26,0`,
};

export default csvFixtures;
