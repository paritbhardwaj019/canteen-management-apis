const convertToIST = (utcDate) => {
  // Create a date object
  const date = new Date(utcDate);
  
  // Add 5 hours and 30 minutes for IST offset
  date.setHours(date.getHours() + 5);
  date.setMinutes(date.getMinutes() + 30);
  
  // Format to ISO string and slice to get desired format
  return date.toISOString().slice(0, 19);  // Returns: "2025-03-27T01:13:14"
};

const convertToLocal = (utcDate) => {
    // Create a date object
    const date = new Date(utcDate);
    
    // Create a formatter that explicitly works with IST timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  
    // Format the date
    const [
      { value: month },,
      { value: day },,
      { value: year },,
      { value: hour },,
      { value: minute },,
      { value: second }
    ] = formatter.formatToParts(date);
  
    // Return in ISO-like format
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  };

const getISTDayBoundaries = (date) => {
  const istDate = convertToLocal(date);
  const startOfDay = new Date(istDate.split('T')[0]);
  const endOfDay = new Date(istDate.split('T')[0]);
  
  // Set end of day time
  endOfDay.setHours(23, 59, 59, 999);
  
  // Adjust for IST offset
  startOfDay.setHours(startOfDay.getHours() - 5, startOfDay.getMinutes() - 30);
  endOfDay.setHours(endOfDay.getHours() - 5, endOfDay.getMinutes() - 30);
  
  return {
    start: startOfDay,
    end: endOfDay
  };
};

module.exports = {
  convertToIST,
  convertToLocal,
  getISTDayBoundaries
}; 