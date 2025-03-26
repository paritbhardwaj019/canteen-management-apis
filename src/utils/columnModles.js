const getUserColumns = (userRole) => {
  // Base columns for all users
  const baseColumns = [
    { field: "plantCode", headerName: "Plant Code", width: 150 },
    { field: "plantName", headerName: "Plant", width: 150 },
    { field: "name", headerName: "Name", width: 150 },
    { field: "email", headerName: "User Email", width: 150 },
    { field: "code", headerName: "User Code", width: 150 },
    { field: "roleName", headerName: "Role", width: 150 },
    { field: "createdAt", headerName: "Created At", width: 150 },
  ];

  // Add admin-specific columns
  if (userRole === "ADMIN") {
    baseColumns.push({
      field: "handleProcess",
      headerName: "Actions",
      width: 150,
    });
  }

  return baseColumns;
};

const getMenuColumns = (userRole) => {
  const baseColumns = [
    { field: "type", headerName: "Type", width: 150 },
    { field: "price", headerName: "Price", width: 150 },
    {
      field: "empContribution",
      headerName: "Employee Contribution",
      width: 150,
    },
    {
      field: "emrContribution",
      headerName: "Employee Contribution",
      width: 150,
    },
    { field: "name", headerName: "Name", width: 150 },
  ];

  if (userRole !== "Employee") {
    baseColumns.push({ field: "edit", headerName: "Edit", width: 150 });
    baseColumns.push({ field: "delete", headerName: "Delete", width: 150 });
  }

  return baseColumns;
};

const getMealRequestColumns = (userRole) => {
  const baseColumns = [
    { field: "date", headerName: "Date", width: 150 },
    { field: "plantName", headerName: "Plant", width: 150 },
    { field: "plantCode", headerName: "Plant Code", width: 150 },
    { field: "quantity", headerName: "Quantity", width: 150 },
    { field: "totalPrice", headerName: "Total Price", width: 150 },
    { field: "name", headerName: "Employee Name", width: 150 }, 
    { field: "mealName", headerName: "Meal Name", width: 150 },
    {
      field: "empContribution",
      headerName: "Employee Contribution",
      width: 150,
    },
    {
      field: "emrContribution",
      headerName: "Employee Contribution",
      width: 150,
    },
    { field: "createdAt", headerName: "Created At", width: 150 },
  ];

  // if (userRole !== "Employee") {
  //   baseColumns.push({ field: "approve", headerName: "Approve", width: 150 });
  //   baseColumns.push({ field: "reject", headerName: "Reject", width: 150 });
  // }

  return baseColumns;
};

const getCanteenReportColumns = () => {
  return [
    { field: "plantName", headerName: "Plant Name", width: 150 },
    { field: "plantCode", headerName: "Plant Code", width: 150 },
    { field: "date", headerName: "Date", width: 150 },
    { field: "employeeNo", headerName: "Employee No", width: 150 },
    { field: "employeeName", headerName: "Employee Name", width: 150 },
    { field: "quantity", headerName: "Quantity", width: 150 },
    { field: "price", headerName: "Total Price", width: 150 }, 
    { field: "employerContribution", headerName: "Employer Contribution", width: 150 },
    { field: "employeeContribution", headerName: "Employee Contribution", width: 150 },
   
  ];
};

const getVisitorRequestColumns = () => {
  return [
    { field: "plantName", headerName: "Plant", width: 150 },
    { field: "plantCode", headerName: "Plant Code", width: 150 },
    { field: "visitDate", headerName: "Visit Date", width: 150 },
    { field: "visitorName", headerName: "Visitor Name", width: 150 },
    { field: "company", headerName: "Company", width: 150 },
    { field: "contact", headerName: "Contact", width: 150 },
    { field: "visitorEmail", headerName: "Email", width: 150 },
    { field: "purpose", headerName: "Purpose", width: 150 },
  
    { field: "host", headerName: "Host", width: 150 },
    { field: "status", headerName: "Status", width: 150 },
    { field: "photo", headerName: "Photo", width: 150 },
    { field: "visitorCount", headerName: "Visitor Count", width: 150 },
    { field: "approvedBy", headerName: "Approved By", width: 150 },
    { field: "createdAt", headerName: "Created At", width: 150 },
  ];
};
module.exports = {
  getUserColumns,
  getMenuColumns,
  getMealRequestColumns,
  getCanteenReportColumns,
  getVisitorRequestColumns,
};
