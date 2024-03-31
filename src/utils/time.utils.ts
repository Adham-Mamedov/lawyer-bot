export const getNextDayMidnightInUTC = () => {
  // Step 1: Get tomorrow's date at 00:00 local time
  let now = new Date();
  let tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Step 2: Adjust for the target timezone (+05:00)
  let uzbekistanTimezoneOffset = 5;
  let offsetInMillis = uzbekistanTimezoneOffset * 60 * 60 * 1000;

  let currentOffsetInMillis = tomorrow.getTimezoneOffset() * 60 * 1000;
  let adjustedDateInMillis =
    tomorrow.getTime() + currentOffsetInMillis + offsetInMillis;
  let adjustedDate = new Date(adjustedDateInMillis);

  // Step 3: Convert to UTC
  return adjustedDate.toISOString();
};
