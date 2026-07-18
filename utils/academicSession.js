const SESSION_START_MONTH = 9 // September

function getCurrentSessionYear() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentCalendarYear = now.getFullYear()

  if (currentMonth < SESSION_START_MONTH) {
    return currentCalendarYear - 1
  }
  return currentCalendarYear
}

function getCurrentLevel(enrollmentYear) {
  const sessionYear = getCurrentSessionYear()
  const yearsElapsed = sessionYear - enrollmentYear

  if (yearsElapsed < 0) return null

  const level = 100 + (yearsElapsed * 100)
  return `${level}L`
}

function getSessionLabel() {
  const startYear = getCurrentSessionYear()
  return `${startYear}/${startYear + 1}`
}

module.exports = { getCurrentLevel, getCurrentSessionYear, getSessionLabel }
