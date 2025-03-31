const { replaceSpacesInEmails } = require("./services/employee.service");

(async () => {
  await replaceSpacesInEmails();
})();
