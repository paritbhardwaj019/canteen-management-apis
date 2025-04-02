const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const prisma = new PrismaClient();

async function updateEmployeeContacts() {
  try {
    console.log("Starting employee contact update process...");

    const workbook = XLSX.readFile(
      path.resolve(__dirname, "../", "public/add employee details.xlsx")
    );
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const employees = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${employees.length} employees in Excel file`);

    const successLog = [];
    const errorLog = [];

    const possibleCodeFields = [
      "employee_code",
      "employeeNo",
      "employeeCode",
      "employee_no",
      "code",
    ];

    for (const employee of employees) {
      try {
        let employeeCode = null;
        for (const field of possibleCodeFields) {
          if (employee[field] !== undefined) {
            employeeCode = employee[field];
            break;
          }
        }

        if (!employeeCode) {
          const errorMsg = `Could not find employee code in record: ${JSON.stringify(
            employee
          )}`;
          console.log(errorMsg);
          errorLog.push(errorMsg);
          continue;
        }

        // Convert employeeCode to string
        const employeeCodeStr = employeeCode.toString();

        // Determine the contact field name in the Excel file
        let contactValue = null;
        for (const key of Object.keys(employee)) {
          if (
            key.toLowerCase().includes("contact") ||
            key.toLowerCase().includes("phone") ||
            key.toLowerCase().includes("mobile")
          ) {
            contactValue = employee[key];
            break;
          }
        }

        if (!contactValue) {
          const errorMsg = `No contact information found for employee ${employeeCodeStr}`;
          console.log(errorMsg);
          errorLog.push(errorMsg);
          continue;
        }

        // First, try to find the employee by employeeNo
        let employeeRecord = await prisma.employee.findUnique({
          where: { employeeNo: employeeCodeStr },
          include: { user: true },
        });

        // If not found, try to find by user's code
        if (!employeeRecord) {
          const userWithCode = await prisma.user.findUnique({
            where: { code: employeeCodeStr },
            include: { employee: true },
          });

          if (userWithCode && userWithCode.employee) {
            employeeRecord = userWithCode.employee;
            employeeRecord.user = userWithCode;
          }
        }

        // If still not found, we need to handle this case
        if (!employeeRecord) {
          const errorMsg = `Could not find employee or user with code ${employeeCodeStr}`;
          console.log(errorMsg);
          errorLog.push(errorMsg);
          continue;
        }

        // Update the employee record
        await prisma.employee.update({
          where: { id: employeeRecord.id },
          data: { contact: contactValue.toString() },
        });

        // Make sure the user.code is synchronized with employee.employeeNo
        if (
          employeeRecord.user &&
          employeeRecord.user.code !== employeeCodeStr
        ) {
          await prisma.user.update({
            where: { id: employeeRecord.user.id },
            data: { code: employeeCodeStr },
          });

          console.log(`Updated user.code for ${employeeCodeStr}`);
        }

        const successMsg = `Updated employee ${employeeCodeStr} with contact ${contactValue}`;
        console.log(successMsg);
        successLog.push(successMsg);
      } catch (err) {
        const errorMsg = `Error processing employee record: ${err.message}`;
        console.error(errorMsg);
        errorLog.push(errorMsg);
      }
    }

    // Write logs to files
    fs.writeFileSync(
      "employee-contact-update-success.log",
      successLog.join("\n")
    );
    fs.writeFileSync("employee-contact-update-errors.log", errorLog.join("\n"));

    console.log(`
Update Summary:
- ${successLog.length} employees updated successfully
- ${errorLog.length} errors encountered
- Logs saved to employee-contact-update-success.log and employee-contact-update-errors.log
    `);

    console.log("Employee contact update process completed!");
  } catch (error) {
    console.error("Error in update process:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update function
updateEmployeeContacts();
