/**
 * Column definitions for data tables in the plant management system
 */

const plantColumns = [
  { field: "plantCode", headerName: "Plant Code", width: 120 },
  { field: "name", headerName: "Plant Name", width: 200 },
  { field: "location", headerName: "Location", width: 200 },
  { field: "deviceName", headerName: "Device Name", width: 150 },
  { field: "serialNumber", headerName: "Serial Number", width: 150 },
  { field: "plantHeadName", headerName: "Plant Head", width: 150 },
  { field: "userCount", headerName: "User Count", width: 100 },
  { field: "createdAt", headerName: "Created At", width: 150 },
];

const plantUserColumns = [
  { field: "employeeCode", headerName: "Employee Code", width: 150 },
  { field: "plantName", headerName: "Plant", width: 150 },
  { field: "name", headerName: "Name", width: 180 },
  { field: "email", headerName: "Email", width: 200 },
  { field: "mobileNumber", headerName: "Mobile Number", width: 150 },
  { field: "plainPassword", headerName: "Password", width: 150, hide: true },
  { field: "role", headerName: "Role", width: 120 },
  { field: "department", headerName: "Department", width: 150 },
  { field: "isPlantHead", headerName: "Plant Head", width: 100 },
  { field: "dateRegistered", headerName: "Date Registered", width: 150 },
  { field: "createdAt", headerName: "Created At", width: 150 },
];

const availableUserColumns = [
  { field: "employeeCode", headerName: "Employee Code", width: 150 },
  { field: "name", headerName: "Name", width: 180 },
  { field: "email", headerName: "Email", width: 200 },
  { field: "mobileNumber", headerName: "Mobile Number", width: 150 },
  { field: "role", headerName: "Role", width: 120 },
  { field: "department", headerName: "Department", width: 150 },
  { field: "createdAt", headerName: "Created At", width: 150 },
];

module.exports = {
  plantColumns,
  plantUserColumns,
  availableUserColumns,
};
