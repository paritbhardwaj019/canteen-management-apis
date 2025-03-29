const axios = require("axios");
const config = require("../config/config");
const { badRequest, serverError } = require("../utils/api.error");
const xml2js = require("xml2js");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Get all ESSL devices
 * @returns {Promise<Array>} List of ESSL devices
 */

const getAllDevices = async () => {
  try {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetDeviceList xmlns="http://tempuri.org/">
      <UserName>${config.essl.username}</UserName>
      <Password>${config.essl.password}</Password>
      <Location>Chennai</Location>
    </GetDeviceList>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: "post",
      url: `${config.essl.bioServerUrl}/iclock/webservice.asmx?op=GetDeviceList`,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/GetDeviceList",
      },
      data: soapBody,
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const deviceListString =
      result["soap:Envelope"]["soap:Body"].GetDeviceListResponse
        .GetDeviceListResult;

    if (!deviceListString || deviceListString === "") {
      return [];
    }

    const deviceArray = deviceListString
      .split(";")
      .filter((device) => device.trim() !== "");

    const devices = deviceArray.map((device) => {
      const [name, serialNumber, location] = device.split(",");
      return {
        name,
        serialNumber,
        location: parseInt(location, 10),
      };
    });

    return devices;
  } catch (error) {
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(`Error connecting to ESSL server: ${error.message}`);
  }
};

/**
 * Get device logs for a specific date and location
 * @param {String} date - Log date in YYYY-MM-DD format
 * @param {String|Number} location - Location ID
 * @returns {Promise<Array>} Device logs
 */
const getDeviceLogs = async (date, location) => {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw badRequest("Invalid date format. Use YYYY-MM-DD format");
    }

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <GetDeviceLogs xmlns="http://tempuri.org/">
        <UserName>${config.essl.username}</UserName>
        <Password>${config.essl.password}</Password>
        <Location>${location}</Location>
        <LogDate>${date}</LogDate>
      </GetDeviceLogs>
    </soap:Body>
  </soap:Envelope>`;

    const response = await axios({
      method: "post",
      url: `${config.essl.bioServerUrl}/iclock/webservice.asmx?op=GetDeviceLogs`,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/GetDeviceLogs",
      },
      data: soapBody,
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const logsString =
      result["soap:Envelope"]["soap:Body"].GetDeviceLogsResponse
        .GetDeviceLogsResult;

    if (!logsString || logsString === "") {
      return [];
    }

    const logsArray = logsString.split(";").filter((log) => log.trim() !== "");

    const logs = logsArray.map((log) => {
      const [rawLogTime, user, deviceName, location, direction] =
        log.split(",");

      const logTime = rawLogTime.replace(/[\r\n\s]+/g, "").trim();

      return {
        logTime,
        user,
        deviceName,
        location: parseInt(location, 10),
        direction,
      };
    });

    return logs;
  } catch (error) {
    console.error("Error fetching ESSL device logs:", error);
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(`Error connecting to ESSL server: ${error.message}`);
  }
};

/**
 * Register or update an employee in the ESSL system
 * @param {Object} employeeData - Employee data to be registered
 * @param {String} employeeData.employeeCode - Employee number/code
 * @param {String} employeeData.employeeName - Employee full name
 * @param {String} employeeData.employeeLocation - Employee location
 * @param {String} employeeData.employeeRole - Employee role
 * @param {String} employeeData.employeeVerificationType - Verification type (e.g., "Card", "Fingerprint")
 * @returns {Promise<String>} Registration result
 */
const updateEmployee = async (employeeData) => {
  try {
    const {
      employeeCode,
      employeeName,
      employeeLocation = "Chennai",
      employeeRole = "Normal User",
      employeeVerificationType = "Finger or Face or Card or Password",
    } = employeeData;

    if (!employeeCode) {
      throw badRequest("Employee code is required");
    }

    if (!employeeName) {
      throw badRequest("Employee name is required");
    }

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <UpdateEmployee xmlns="http://tempuri.org/">
      <UserName>${config.essl.username}</UserName>
      <Password>${config.essl.password}</Password>
      <EmployeeCode>${employeeCode}</EmployeeCode>
      <EmployeeName>${employeeName}</EmployeeName>
      <EmployeeLocation>${employeeLocation}</EmployeeLocation>
      <EmployeeRole>${employeeRole}</EmployeeRole>
      <EmployeeVerificationType>${employeeVerificationType}</EmployeeVerificationType>
    </UpdateEmployee>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: "post",
      url: `${config.essl.bioServerUrl}/iclock/webservice.asmx?op=UpdateEmployee`,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/UpdateEmployee",
      },
      data: soapBody,
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const updateResult =
      result["soap:Envelope"]["soap:Body"].UpdateEmployeeResponse
        .UpdateEmployeeResult;

    return updateResult;
  } catch (error) {
    console.error("Error updating employee in ESSL system:", error);
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(`Error connecting to ESSL server: ${error.message}`);
  }
};

/**
 * Update an employee's photo in the ESSL system
 * @param {Object} photoData - Employee photo data
 * @param {String} photoData.employeeCode - Employee number/code
 * @param {String} photoData.employeePhoto - Base64 encoded photo data
 * @returns {Promise<String>} Photo update result
 */
const updateEmployeePhoto = async (photoData) => {
  try {
    const { employeeCode, employeePhoto, deviceSerialNumber } = photoData;
    // console.log("photoData", photoData);
    if (!employeeCode) {
      throw badRequest("Employee code is required");
    }

    if (!employeePhoto) {
      throw badRequest("Employee photo (base64) is required");
    }

    // if (!deviceSerialNumber) {
    //   throw badRequest("Device serial number is required");
    // }

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <UpdateEmployeePhoto xmlns="http://tempuri.org/">
      <UserName>${config.essl.username}</UserName>
      <Password>${config.essl.password}</Password>
      <EmployeeCode>${employeeCode}</EmployeeCode>
      <EmployeePhoto>${employeePhoto}</EmployeePhoto>
    </UpdateEmployeePhoto>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: "post",
      url: `${config.essl.bioServerUrl}/iclock/webservice.asmx?op=UpdateEmployeePhoto`,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/UpdateEmployeePhoto",
      },
      data: soapBody,
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const updateResult =
      result["soap:Envelope"]["soap:Body"].UpdateEmployeePhotoResponse
        .UpdateEmployeePhotoResult;

    return updateResult;
  } catch (error) {
    console.error("Error updating employee photo in ESSL system:", error);
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(`Error connecting to ESSL server: ${error.message}`);
  }
};

const addNewLocation = async (locationData) => {
  try {
    const { deviceName, serialNumber, locationType } = locationData;
    if (!deviceName || !serialNumber || !locationType) {
      throw badRequest(
        "Device Name, Serial Number and Location Type are required"
      );
    }

    const existingDevice = await prisma.locations.findFirst({
      where: { serialNumber },
    });
    if (existingDevice) {
      throw badRequest("Device already exists");
    }
    const newDevice = await prisma.locations.create({
      data: {
        deviceName,
        serialNumber,
        locationType,
      },
    });

    return newDevice;
  } catch (error) {
    console.error("Error adding new device in locations table:", error);
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(
      `Error adding new device in locations table: ${error.message}`
    );
  }
};

const getAllLocations = async () => {
  try {
    const locations = await prisma.locations.findMany();
    return locations;
  } catch (error) {
    console.error("Error fetching all locations:", error);
    throw serverError(`Error fetching all locations: ${error.message}`);
  }
};

const deleteLocation = async (id) => {
  try {
    const deletedLocation = await prisma.locations.delete({
      where: { id },
    });
    return deletedLocation;
  } catch (error) {
    console.error("Error deleting location:", error);
    throw serverError(`Error deleting location: ${error.message}`);
  }
};

const updateLocation = async (id, locationData) => {
  try {
    const updatedLocation = await prisma.locations.update({
      where: { id },
      data: locationData,
    });
    return updatedLocation;
  } catch (error) {
    console.error("Error updating location:", error);
    throw serverError(`Error updating location: ${error.message}`);
  }
};

// Add this new function
const resetOpstamp = async (deviceSerialNumber) => {
  console.log("resetOpstamp", deviceSerialNumber);
  try {
    if (!deviceSerialNumber) {
      throw badRequest("Device serial number is required");
    }

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <DeviceCommand_ResetOPStamp xmlns="http://tempuri.org/">
      <UserName>${config.essl.username}</UserName>
      <Password>${config.essl.password}</Password>
      <DeviceSerialNumber>${deviceSerialNumber}</DeviceSerialNumber>
    </DeviceCommand_ResetOPStamp>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: "post",
      url: `${config.essl.bioServerUrl}/iclock/webservice.asmx?op=DeviceCommand_ResetOPStamp`,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/DeviceCommand_ResetOPStamp",
      },
      data: soapBody,
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const resetResult =
      result["soap:Envelope"]["soap:Body"].DeviceCommand_ResetOPStampResponse
        .DeviceCommand_ResetOPStampResult;

    return resetResult;
  } catch (error) {
    console.error("Error resetting opstamp:", error);
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(`Error connecting to ESSL server: ${error.message}`);
  }
};

/**
 * Update an employee's face data in a specific device
 * @param {Object} faceData - Employee face enrollment data
 * @param {String} faceData.employeeCode - Employee number/code
 * @param {String} faceData.deviceSerialNumber - Serial number of the target device
 * @returns {Promise<String>} Face enrollment result
 */
const updateEmployeeFaceInDevice = async (faceData) => {
  try {
    const { employeeCode, deviceSerialNumber } = faceData;

    if (!employeeCode) {
      throw badRequest("Employee code is required");
    }

    if (!deviceSerialNumber) {
      throw badRequest("Device serial number is required");
    }

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <DeviceCommand_EnrollFace xmlns="http://tempuri.org/">
      <UserName>${config.essl.username}</UserName>
      <Password>${config.essl.password}</Password>
      <DeviceSerialNumber>${deviceSerialNumber}</DeviceSerialNumber>
      <EmployeeCode>${employeeCode}</EmployeeCode>
    </DeviceCommand_EnrollFace>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios({
      method: "post",
      url: `${config.essl.bioServerUrl}/iclock/webservice.asmx?op=DeviceCommand_EnrollFace`,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/DeviceCommand_EnrollFace",
      },
      data: soapBody,
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const enrollResult =
      result["soap:Envelope"]["soap:Body"].DeviceCommand_EnrollFaceResponse
        .DeviceCommand_EnrollFaceResult;

    console.log("Face enrollment result:", enrollResult);

    if (enrollResult && enrollResult.includes("success")) {
      console.log("Face enrollment successful, resetting opstamp...");
      const resetResult = await resetOpstamp(deviceSerialNumber);
      console.log("Opstamp reset result:", resetResult);
    }

    return enrollResult;
  } catch (error) {
    console.error("Error enrolling employee face in device:", error);
    if (error.response) {
      throw badRequest(
        `ESSL API Error: ${error.response.data || error.message}`
      );
    }
    throw serverError(`Error connecting to ESSL server: ${error.message}`);
  }
};

const esslService = {
  getAllDevices,
  getDeviceLogs,
  updateEmployee,
  updateEmployeePhoto,
  resetOpstamp,
  addNewLocation,
  getAllLocations,
  deleteLocation,
  updateLocation,
  updateEmployeeFaceInDevice,
};

module.exports = esslService;
