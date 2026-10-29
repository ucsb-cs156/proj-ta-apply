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
};

export default csvFixtures;
