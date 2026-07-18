const FUASK_DEPARTMENTS = {
  'FUAS/CPC/CSE': { department: 'Cyber Security', faculty: 'Faculty of Computing and Communication', facultyCode: 'CPC', duration: 4 },
  'FUAS/CPC/SE':  { department: 'Software Engineering', faculty: 'Faculty of Computing and Communication', facultyCode: 'CPC', duration: 4 },
  'FUAS/CPC/CSC': { department: 'Computer Science', faculty: 'Faculty of Computing and Communication', facultyCode: 'CPC', duration: 4 },
  'FUAS/CPC/IT':  { department: 'Information Technology', faculty: 'Faculty of Computing and Communication', facultyCode: 'CPC', duration: 4 },
  'FUAS/MED/MBBS': { department: 'Medicine and Surgery', faculty: 'Faculty of Medicine', facultyCode: 'MED', duration: 6 },
  'FUAS/MED/ANA': { department: 'Anatomy', faculty: 'Faculty of Medicine', facultyCode: 'MED', duration: 5 },
  'FUAS/MED/PHY': { department: 'Physiology', faculty: 'Faculty of Medicine', facultyCode: 'MED', duration: 5 },
  'FUAS/AHS/BMLS': { department: 'Medical Laboratory Science', faculty: 'Faculty of Allied Health Sciences', facultyCode: 'AHS', duration: 5 },
  'FUAS/AHS/NS':  { department: 'Nursing Science', faculty: 'Faculty of Allied Health Sciences', facultyCode: 'AHS', duration: 5 },
  'FUAS/AHS/RAD': { department: 'Radiography', faculty: 'Faculty of Allied Health Sciences', facultyCode: 'AHS', duration: 5 },
  'FUAS/AHS/HIM': { department: 'Health Information Management', faculty: 'Faculty of Allied Health Sciences', facultyCode: 'AHS', duration: 4 },
  'FUAS/PHAR/PHAR': { department: 'Doctor of Pharmacy', faculty: 'Faculty of Pharmacy', facultyCode: 'PHAR', duration: 6 },
  'FUAS/ERM/QS':  { department: 'Quantity Surveying', faculty: 'Faculty of ERM', facultyCode: 'ERM', duration: 5 },
  'FUAS/ERM/ERM': { department: 'Environmental Resource Management', faculty: 'Faculty of ERM', facultyCode: 'ERM', duration: 4 },
  'FUAS/SCI/BIOT': { department: 'Biotechnology', faculty: 'Faculty of Sciences', facultyCode: 'SCI', duration: 4 },
  'FUAS/SCI/MIC': { department: 'Microbiology', faculty: 'Faculty of Sciences', facultyCode: 'SCI', duration: 4 },
  'FUAS/SCI/ICH': { department: 'Industrial Chemistry', faculty: 'Faculty of Sciences', facultyCode: 'SCI', duration: 4 },
  'FUAS/ARCH/ARCH': { department: 'Architecture', faculty: 'Faculty of Architecture', facultyCode: 'ARCH', duration: 5 }
}

function validateMatric(matricNumber) {
  if (!matricNumber || typeof matricNumber !== 'string') {
    return { valid: false, error: 'Matric number is required' }
  }

  const cleaned = matricNumber.trim().toUpperCase()
  const parts = cleaned.split('/')

  if (parts.length !== 5) {
    return { valid: false, error: 'Invalid matric format. Expected: FUAS/XXX/XXX/YY/NNNN' }
  }
  if (parts[0] !== 'FUAS') {
    return { valid: false, error: 'Not a recognized FUASK matric number' }
  }

  const key = `FUAS/${parts[1]}/${parts[2]}`
  const deptInfo = FUASK_DEPARTMENTS[key]
  if (!deptInfo) {
    return { valid: false, error: 'Unknown department code' }
  }

  const yearCode = parts[3]
  if (!/^\d{2}$/.test(yearCode)) {
    return { valid: false, error: 'Invalid enrollment year code' }
  }

  const serial = parts[4]
  if (!/^\d{4}$/.test(serial)) {
    return { valid: false, error: 'Invalid serial number' }
  }

  return {
    valid: true,
    matricNumber: cleaned,
    department: deptInfo.department,
    faculty: deptInfo.faculty,
    facultyCode: deptInfo.facultyCode,
    deptCode: parts[2],
    enrollmentYear: 2000 + parseInt(yearCode, 10),
    programDuration: deptInfo.duration
  }
}

module.exports = validateMatric
