const express = require("express");
const router = express.Router();
const userDao = require("./server/Dao/usersDao.js");

router.post("/check-email-exists", async (req, res) => {
  try {
    // const { email } = req.body;
    // const exists = await userDao.checkEmailExists(email);

    console.log("CHECK EMAIL ROUTER");
    const email = req.body.email;
    console.log("EMAIL:", email);
    const exists = await userDao.checkEmailExists(email);
    res.json({ exists });
  } catch (error) {
    console.error("Error checking email exists:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/send-otp", async (req, res) => {
  try {
    const { email, contactNumber } = req.body;
    await userDao.sendOTP(email, contactNumber);
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    console.log("Received OTP verification request:", req.body);
    const { email, enteredOTP } = req.body;

    // Call the function to verify OTP
    const result = await userDao.verifyOTP(email, enteredOTP);

    // Check if OTP is valid
    if (result.isValidOTP) {
      // Access the email from the result and use it if needed
      const { email: userEmail } = result;
      res.json({
        isValidOTP: true,
        message: "OTP verification successful",
        userEmail,
      });
    } else {
      res
        .status(401)
        .json({ isValidOTP: false, message: "Invalid OTP or OTP expired" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Call the function to update the password
    await userDao.resetPassword(email, newPassword);

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching user data
router.post("/fetch-user-data", async (req, res) => {
  console.log("Received request to /fetch-user-data");
  try {
    await userDao.fetchUserData(req, res);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching school data
router.get("/fetch-school-data", async (req, res) => {
  console.log("Received request to /fetch-school-data");
  try {
    await userDao.fetchSchoolData(req, res);
  } catch (error) {
    console.error("Error fetching school data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// routes.js (backend)
router.get("/fetch-school-data/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-school-data/:schoolId");
  try {
    await userDao.fetchSchoolDetails(req, res);
  } catch (error) {
    console.error("Error fetching school details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching user counts for a specific school
router.get("/fetch-user-counts/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-user-counts/:schoolId");
  try {
    await userDao.fetchUserCounts(req, res);
  } catch (error) {
    console.error("Error fetching user counts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for adding a new school
router.post("/add-school", async (req, res) => {
  console.log("Received request to /add-school");
  try {
    await userDao.addSchool(req, res);
  } catch (error) {
    console.error("Error adding school:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add new routes for fetching teachers and students for a specific school
router.get("/fetch-teachers/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-teachers/:schoolId");
  try {
    await userDao.fetchTeachersForSchool(req, res);
  } catch (error) {
    console.error("Error fetching teachers data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/fetch-students/:schoolId", async (req, res) => {
  console.log("Received request to /fetch-students/:schoolId");
  try {
    await userDao.fetchStudentsForSchool(req, res);
  } catch (error) {
    console.error("Error fetching students data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/add-teacher/:schoolId", async (req, res) => {
  console.log("Received request to /add-teacher/:schoolId");
  try {
    // Extract the schoolId from the URL parameters
    const { schoolId } = req.params;

    // Attach the schoolId to the request body
    req.body.schoolId = schoolId;

    // Call the addTeacher function in userDao.js
    await userDao.addTeacher(req, res);
  } catch (error) {
    console.error("Error adding teacher:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to add a student to a specific school
router.post("/add-student/:schoolId", async (req, res) => {
  console.log("Received request to /add-student/:schoolId");
  try {
    // Extract the schoolId from the URL parameters
    const { schoolId } = req.params;

    // Attach the schoolId to the request body
    req.body.schoolId = schoolId;

    // Call the addStudent function in userDao.js
    await userDao.addStudent(req, res);
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Add a new route for fetching teacher details
router.get("/fetch-teacher-details/:schoolId/:userId", async (req, res) => {
  console.log("Received request to /fetch-teacher-details/:schoolId/:userId");
  try {
    // Extract the schoolId and userId from the URL parameters
    const { userId, schoolId } = req.params;

    // Attach the schoolId , userId to the request body
    req.body.userId = userId;
    req.body.schoolId = schoolId;

    // Call the fetchTeacherDetails function in userDao.js
    await userDao.fetchTeacherDetails(req, res);
  } catch (error) {
    console.error("Error fetching teacher details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Add a new route for fetching student details
router.get("/fetch-student-details/:schoolId/:userId", async (req, res) => {
  console.log("Received request to /fetch-student-details/:schoolId/:userId");
  try {
    // Extract the schoolId and userId from the URL parameters
    const { userId, schoolId } = req.params;

    // Attach the schoolId , userId to the request body
    req.body.userId = userId;
    req.body.schoolId = schoolId;

    // Call the fetchStudentDetails function in userDao.js
    await userDao.fetchStudentDetails(req, res);
  } catch (error) {
    console.error("Error fetching student details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// New route for fetching subjects
router.get('/get-subjects', async (req, res) => {
  console.log('Received request to /api/get-subjects');
  try {
    await userDao.fetchSubjects(req, res);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// New route for fetching classes
router.get('/get-classes', async (req, res) => {
  console.log('Received request to /api/get-classes');
  try {
    await userDao.fetchClasses(req, res);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/create-course', async (req, res) => {
  console.log('Received request to /api/create-course');
  try {
    await userDao.createCourse(req, res);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// New route for fetching all mentors data
router.get("/fetch-all-mentors-data", async (req, res) => {
  console.log("Received request to /fetch-all-mentors-data");
  try {
    await userDao.fetchAllMentorsData(req, res);
  } catch (error) {
    console.error("Error fetching mentors data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// New route for adding a new mentor
router.post("/add-mentor", async (req, res) => {
  console.log("Received request to /add-mentor");
  try {
    await userDao.addMentor(req, res);
  } catch (error) {
    console.error("Error adding mentor:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// New route for fetching mentors
router.get('/get-mentors', async (req, res) => {
  console.log('Received request to /api/get-mentors');
  try {
    await userDao.fetchMentors(req, res);
  } catch (error) {
    console.error('Error fetching mentors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


/////////////////////////////////////////
//---------Testing Code-----------------
/////////////////////////////////////////


// routes.js



// Export the router
module.exports = router;
