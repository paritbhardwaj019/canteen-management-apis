const getUserColumns = (userRole) => {
    // Base columns for all users
    const baseColumns = [
      { field: 'employeeCode', headerName: 'Employee Code', width: 150 },
      { field: 'plantName', headerName: 'Plant', width: 150 },
      { field: 'name', headerName: 'Name', width: 150 },
      { field: 'mobileNumber', headerName: 'Mobile Number', width: 150 },
      { field: 'plainPassword', headerName: 'Password', width: 150 },
      { field: 'role', headerName: 'Role', width: 150 },
      { field: 'dateRegistered', headerName: 'Date Registered', width: 150 },
      { field: 'createdAt', headerName: 'Created At', width: 150 },
  
    ];
    
    // Add admin-specific columns
    if (userRole === 'ADMIN') {
      baseColumns.push({ field: 'handleProcess', headerName: 'Actions', width: 150 });
    }
    
    return baseColumns;
  };

const getMenuColumns = (userRole) => {
    const baseColumns = [
        { field: 'type', headerName: 'Type', width: 150 },
        { field: 'price', headerName: 'Price', width: 150 },
        { field: 'empContribution', headerName: 'Employee Contribution', width: 150 },
        { field: 'emrContribution', headerName: 'Employee Contribution', width: 150 },
        { field: 'name', headerName: 'Name', width: 150 },
    ];

    if (userRole !== 'Employee') {
        baseColumns.push({ field: 'edit', headerName: 'Edit', width: 150 });
        baseColumns.push({ field: 'delete', headerName: 'Delete', width: 150 });
    }

    return baseColumns;
};


const getMealRequestColumns = (userRole) => {
    const baseColumns = [
        { field: 'date', headerName: 'Date', width: 150 },
        { field: 'quantity', headerName: 'Quantity', width: 150 },
        { field: 'totalPrice', headerName: 'Total Price', width: 150 },
        { field: 'mealType', headerName: 'Meal Type', width: 150 },
        { field: 'status', headerName: 'Status', width: 150 },
        { field: 'empContribution', headerName: 'Employee Contribution', width: 150 },
        { field: 'emrContribution', headerName: 'Employee Contribution', width: 150 },
        { field: 'createdAt', headerName: 'Created At', width: 150 },
    ];

    if (userRole !== 'Employee') {
        baseColumns.push({ field: 'approve', headerName: 'Approve', width: 150 });
        baseColumns.push({ field: 'reject', headerName: 'Reject', width: 150 });
    }

    return baseColumns;
}

module.exports = {
    getUserColumns,
    getMenuColumns,
    getMealRequestColumns,
  };
  