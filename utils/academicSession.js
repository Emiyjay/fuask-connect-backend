const SESSION_START_MONTH = 9

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

// reverse of getCurrentLevel — needed because 'level' is virtual, not stored,
// so we can't query the database for it directly
function getEnrollmentYearForLevel(levelLabel) {
  const levelNumber = parseInt(levelLabel, 10)
  if (isNaN(levelNumber)) return null
  const yearsElapsed = (levelNumber - 100) / 100
  const sessionYear = getCurrentSessionYear()
  return sessionYear - yearsElapsed
}

module.exports = { getCurrentLevel, getCurrentSessionYear, getSessionLabel, getEnrollmentYearForLevel }
