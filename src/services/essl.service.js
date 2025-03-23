const axios = require("axios");
const config = require("../config/config");
const { badRequest, serverError } = require("../utils/api.error");
const xml2js = require("xml2js");

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
      <Location>1</Location>
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

const esslService = {
  getAllDevices,
  getDeviceLogs,
};

module.exports = esslService;
