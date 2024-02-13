const connectionProvider = require("../mySqlConnectionStringProvider.js");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const bcrypt = require("bcrypt");
const { promisify } = require("util");
const nodemailer = require("nodemailer");
const { query } = require("express");
const sendEmail = require("./emailSender");

const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

dotenv.config();

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// const AWS = require('aws-sdk');

const AWS = require("aws-sdk");

const pool = require("../mySqlConnectionString.js"); // Assuming you have a separate file for creating a connection pool

const unlinkAsync = promisify(fs.unlink);

exports.uploadOrgIcon = async function (req, res) {
  const path = req.file.path;
  const fileContent = fs.readFileSync(path);
  const params = {
    Bucket: "embed-app-bucket",
    Key: "OrgIcon-" + req.params.orgId,
    Body: fileContent,
  };

  const command = new PutObjectCommand(params);

  try {
    const response = await s3Client.send(command);
    console.log("Image uploaded successfully. Location:", response);
    await unlinkAsync(path);
    res.status(200).send({ message: "uploaded successfully" });
  } catch (error) {
    console.error("Error uploading image:", error);
  }
};

exports.retrieveOrgIcon = async function (req, res) {
  const params = {
    Bucket: "embed-app-bucket",
    Key: "OrgIcon-" + req.params.orgId,
    ResponseContentType: "image/jpeg",
  };

  const command = new GetObjectCommand(params);

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log("Image retrieved successfully.", url);
    res.status(200).send({ dataUrl: url });
  } catch (error) {
    console.error("Error retrieving image:", error);
  }
};

// ------------------------ Working Code ---------------------------------------

/////////////////////////////////////////////////////////
//------S3 Bucket ------
/////////////////////////////////////////////////////////

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const uploadFolder = path.join(__dirname, "./server/uploads/");
      console.log("Destination Folder:", uploadFolder);
      await fs.mkdir(uploadFolder, { recursive: true });
      cb(null, uploadFolder);
    } catch (error) {
      console.error("Error creating destination folder:", error);
      cb(error, null);
    }
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    console.log("File Name:", timestamp + "-" + file.originalname);
    cb(null, timestamp + "-" + file.originalname);
  },
});

exports.upload = multer({ storage: storage });

exports.uploadProfileImage = async function (req, res) {
  try {
    const path = req.file.path;
    const fileContent = await fs.readFile(path);
    console.log("PATH: ", path);

    const userId = req.params.userId;

    const params = {
      Bucket: "embed-app-bucket",
      Key: `Image-EdApp:${userId}`, //S3 key
      Body: fileContent,
    };

    const command = new PutObjectCommand(params);

    const response = await s3Client.send(command);
    console.log("Image uploaded successfully. Location:", response);

    // Delete local file after successful upload
    await fs.unlink(path);

    res.status(200).send({ message: "uploaded successfully" });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

exports.updateProfileImage = async function (req, res) {
  try {
    const userId = req.params.userId;

    // Construct S3 key based on userId
    const updateParams = {
      Bucket: "embed-app-bucket",
      Key: `Image-EdApp:${userId}`,
    };

    // Assuming you have the updated image file in the request
    const updatedFilePath = req.file.path;
    const updatedFileContent = await fs.readFile(updatedFilePath);

    updateParams.Body = updatedFileContent;

    const updateCommand = new PutObjectCommand(updateParams);

    // Send the update command to S3
    const updateResponse = await s3Client.send(updateCommand);

    // Log the response from S3 (optional)
    console.log("Update Object Response:", updateResponse);

    // Clean up: Delete local file after successful update
    await fs.unlink(updatedFilePath);

    console.log("Object updated successfully");
    res.status(200).send({ message: "updated successfully" });
  } catch (error) {
    console.error("Error updating object:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

exports.retrieveProfileImage = async function (req, res) {
  try {
    const userId = req.params.userId;

    // Construct S3 key based on userId
    const retrieveParams = {
      Bucket: "embed-app-bucket",
      Key: `Image-EdApp:${userId}`,
    };

    const retrieveCommand = new GetObjectCommand(retrieveParams);

    // Generate a signed URL for the S3 object
    const signedUrl = await getSignedUrl(s3Client, retrieveCommand, {
      expiresIn: 3600,
    });

    console.log("Image retrieved successfully.", signedUrl);

    // Redirect the client to the signed URL
    res.redirect(302, signedUrl);
  } catch (error) {
    console.error("Error retrieving image:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

exports.deleteProfileImage = async function (req, res) {
  try {
    const userId = req.params.userId;

    // Construct S3 key based on userId
    const deleteParams = {
      Bucket: "embed-app-bucket",
      Key: `Image-EdApp:${userId}`,
    };

    const deleteCommand = new DeleteObjectCommand(deleteParams);

    // Send the delete command to S3
    const deleteResponse = await s3Client.send(deleteCommand);

    // Log the response from S3 (optional)
    console.log("Delete Object Response:", deleteResponse);

    console.log("Object deleted successfully");
    res.status(200).send({ message: "deleted successfully" });
  } catch (error) {
    console.error("Error deleting object:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

/////////////////////////////////////////////////////////
//------Login and Reset Password Functions ------
/////////////////////////////////////////////////////////

exports.adminLogin = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = "SELECT * FROM admin_info WHERE email=?";
  const selectQueryPayload = [request.body.email];

  console.log("email:", request.body.email);
  console.log("password:", request.body.password);

  connection.query(
    selectQuery,
    selectQueryPayload,
    function (err, rows, fields) {
      if (err) {
        console.log("ERROR", err);
        response.status(500).send({ error: err });
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      console.log("Rows from the Database:", rows);

      if (rows.length === 1) {
        const storedPassword = rows[0].password;

        // Check if the entered password matches the stored password
        if (request.body.password === storedPassword) {
          // Password matches, proceed with authentication
          proceedWithAuthentication(response, rows[0]);
        } else {
          // Passwords do not match
          console.log("Invalid password");
          response.status(401).send("Invalid credentials");
          connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
            connection
          );
        }
      } else if (rows.length === 0) {
        console.log("Admin not found");
        response.status(404).send("Admin not found");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      } else {
        console.log("Unexpected number of rows:", rows.length);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      }
    }
  );
};

exports.userLogin = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
  const selectQuery = "SELECT * FROM login WHERE sap_id=? ";
  const selectQueryPayload = [request.body.sap_id];

  console.log("sap_id:", request.body.sap_id);
  console.log("password:", request.body.password);

  connection.query(
    selectQuery,
    selectQueryPayload,
    function (err, rows, fields) {
      if (err) {
        console.log("ERROR", err);
        response.status(500).send({ error: err });
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      console.log("Rows from the Database:", rows);

      if (rows.length === 1) {
        const storedPassword = rows[0].password;

        // Check if the entered password matches the stored password
        if (
          !rows[0].is_password_hashed &&
          request.body.password === storedPassword
        ) {
          // Password matches the original numeric password, proceed with authentication
          proceedWithAuthentication(response, rows[0], rows[0].role);
        } else if (bcrypt.compareSync(request.body.password, storedPassword)) {
          // Password matches the hashed password, proceed with authentication
          proceedWithAuthentication(response, rows[0], rows[0].role);
        } else {
          // Passwords do not match
          console.log("Invalid password");
          response.status(401).send("Invalid credentials");
          connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
            connection
          );
        }
      } else if (rows.length === 0) {
        console.log("User not found");
        response.status(404).send("User not found");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      } else {
        console.log("Unexpected number of rows:", rows.length);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
      }
    }
  );
};

function proceedWithAuthentication(response, user) {
  // Continue with authentication logic

  const role = user.role; // Extract user role

  // Generate JWT token with data from login table
  const resToSend = {
    user_id: user.user_id,
    school_id: user.school_id,
    sap_id: user.sap_id,
    school_name: user.school_name,
    role: role,
    first_name: user.first_name,
    last_name: user.last_name,
    middle_name: user.middle_name,
    email: user.email,
    birthdate: user.birthdate,
    contact_number: user.contact_number,
    alternative_contact_number: user.alternative_contact_number,
    permanent_address: user.permanent_address,
    city: user.city,
    state: user.state,
  };

  // If the user is a teacher, fetch additional data from teachers_info
  if (role === "teacher") {
    const additionalDataQuery = `SELECT * FROM teachers_info WHERE user_id = ${user.user_id}`;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    connection.query(additionalDataQuery, function (err, rows, fields) {
      if (err) {
        console.log("Error fetching additional data:", err);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      if (rows.length === 1) {
        // Include additional data in the JWT token
        Object.assign(resToSend, rows[0]);
      }

      // Assuming 'token' is the JWT token
      const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
        expiresIn: "50m",
      });

      const responsePayload = {
        success: true,
        message: "Authentication Successful",
        token: token,
      };

      response.json(responsePayload);
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );
    });
  } else if (role === "student") {
    // If the user is a student, fetch additional data from students_info
    const additionalDataQuery = `SELECT * FROM students_info WHERE user_id = ${user.user_id}`;
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    connection.query(additionalDataQuery, function (err, rows, fields) {
      if (err) {
        console.log("Error fetching additional data:", err);
        response.status(500).send("Internal Server Error");
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        return;
      }

      if (rows.length === 1) {
        // Include additional data in the JWT token
        Object.assign(resToSend, rows[0]);
      }

      // Assuming 'token' is the JWT token
      const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
        expiresIn: "50m",
      });

      const responsePayload = {
        success: true,
        message: "Authentication Successful",
        token: token,
      };

      response.json(responsePayload);
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );
    });
  } else {
    // If the role is neither teacher nor student, generate JWT token directly
    const token = jwt.sign(resToSend, process.env.SECRET_KEY, {
      expiresIn: "50m",
    });

    const responsePayload = {
      success: true,
      message: "Authentication Successful",
      token: token,
    };

    response.json(responsePayload);
  }
}

// Function to check if an email exists in the database
exports.checkEmailExists = async function (email) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    const query = "SELECT COUNT(user_id) AS count FROM login WHERE email = ?";
    connection.query(query, [email], (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        reject(
          "An error occurred while processing your request. Please try again."
        );
      } else {
        console.log("SQL Query:", query, "email:", email);
        const exists = results[0].count > 0;
        resolve({ exists });
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
};

// Helper function to send OTP to the user's email
async function sendOTPByEmail(email, otp) {
  const subject = "Reset Password OTP"; // Specify the subject of the email
  const content = `Your OTP to reset the password is: ${otp}`; // Specify the content of the email

  // Call the `sendEmail` function from `emailSender.js` to send the email
  await sendEmail(email, subject, content);
}

async function storeOTPInDatabase(email, otp, expiryTime) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise(async (resolve, reject) => {
    // Store the OTP, email, and expiry time in the otps database
    const query = "INSERT INTO otps (email, otp, expiry_time) VALUES (?, ?, ?)";
    const queryPayload = [email, otp, expiryTime];

    connection.query(query, queryPayload, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
}

// VIA CONTACT NUMBER IN THE DATABASE
// Helper function to store OTP in the database
// async function storeOTPInDatabase(email, otp, expiryTime) {
//   const connection =
//     connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

//   return new Promise(async (resolve, reject) => {
//     // Fetch Contact_Number from the login database
//     const contactNumberQuery =
//       "SELECT contact_number FROM login WHERE email = ?";
//     const contactNumberResults = await queryDatabase(contactNumberQuery, [
//       email,
//     ]);

//     if (contactNumberResults.length === 1) {
//       const contactNumber = contactNumberResults[0].Contact_Number;

//       // Store the OTP, email, expiry time, and contact number in the otps database
//       const query =
//         "INSERT INTO otps (email, otp, expiry_time, contact_number) VALUES (?, ?, ?, ?)";
//       const queryPayload = [email, otp, expiryTime, contactNumber];

//       connection.query(query, queryPayload, (error) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve();
//         }
//       });
//     } else {
//       reject(new Error("Contact_Number not found for the given email"));
//     }

//     connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//       connection
//     );
//   });
// }

// Helper function to execute a query on the database
// async function queryDatabase(query, params) {
//   const connection =
//     connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

//   return new Promise((resolve, reject) => {
//     connection.query(query, params, (error, results) => {
//       if (error) {
//         reject(error);
//       } else {
//         resolve(results);
//       }
//     });

//     connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
//       connection
//     );
//   });
// }

// Function to store OTP in the database and send it to the user's email
exports.sendOTP = async function (email) {
  try {
    // Generate a 5-digit plain/text OTP
    const plainOTP = Math.floor(10000 + Math.random() * 90000);

    // Store the hashed OTP in the database with an expiry time (e.g., 5 minutes)
    // const hashedOTP = await bcrypt.hash(plainOTP.toString(), 10);
    const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes in milliseconds

    // Store the hashed OTP, expiry time, and contact number in the database
    await storeOTPInDatabase(email, plainOTP, expiryTime);

    // Send the plain OTP to the user's email
    await sendOTPByEmail(email, plainOTP);

    // Delete expired OTPs from the database
    // await deleteExpiredOTPs();

    console.log("OTP successfully sent and stored.");
  } catch (error) {
    console.error("Error sending OTP:", error);
    // Handle error, e.g., log the error or throw it for further handling
    throw new Error(
      "An error occurred while processing your request. Please try again."
    );
  }
};

// Function to verify OTP
exports.verifyOTP = async function (email, enteredOTP) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    const current_Time = new Date().getTime();
    const query = `SELECT * FROM otps WHERE email = ? AND expiry_time > ${current_Time}`;

    connection.query(query, [email], async (error, results) => {
      if (error) {
        console.error("Error executing query:", error);
        reject(error);
      } else {
        console.log("SQL Query:", query, "email:", email);

        // Check if there are any valid OTPs
        if (results.length > 0) {
          const storedOTP = results[0].otp;

          // Compare the entered OTP with the stored OTP
          const isValidOTP = enteredOTP === storedOTP;
          console.log("ISVALIDOTP ===", isValidOTP);

          resolve({ isValidOTP, email });
        } else {
          // No valid OTP found
          resolve({ isValidOTP: false, email });
        }
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
};

// Function to update the password in the login database
exports.resetPassword = async function (email, newPassword) {
  // hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  return new Promise((resolve, reject) => {
    const query = "UPDATE login SET password = ? WHERE email = ?";
    connection.query(query, [hashedPassword, email], (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );
  });
};

///////////////////////////
//------Teacher Portal ------
///////////////////////////

// Function to fetch teacher portal's all courses / publish courses details
exports.fetchUserData = function (request, response) {
  try {
    // Get the token from the request body
    const token = request.body.user_id;

    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
      if (err) {
        // Token verification failed
        console.error("Token verification failed:", err);
        return response.status(401).json({ message: "Unauthorized" });
      }

      // Token verified successfully, extract user_id
      const userId = decoded.user_id;

      // Use userId to fetch user-specific data from the database
      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

      // SQL query to fetch user data, course information, and total chapters
      const selectQuery = `
      SELECT
      login.user_id,
      courses_info.course_name,
      courses_info.status,
      subjects_info.subject_name,
      COUNT(chapters_info.chapter_id) AS total_chapters
      FROM login
      LEFT JOIN courses_info ON login.user_id = courses_info.user_id
      LEFT JOIN chapters_info ON courses_info.course_id = chapters_info.course_id
      LEFT JOIN subjects_info ON courses_info.subject_id = subjects_info.subject_id
      WHERE login.user_id = ?
      GROUP BY courses_info.course_id;

      `;
      const selectQueryPayload = [userId];

      connection.query(selectQuery, selectQueryPayload, (err, rows, fields) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );

        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }

        console.log("User Data:", rows);
        response.json({ userData: rows });
      });
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to create a new course and insert into the database
exports.createCourse = async function (request, response) {
  try {
    const { courseName, courseDescription, subjectId, classId } = request.body;
    console.log("Received Data:", {
      courseName,
      courseDescription,
      subjectId,
      classId,
    });

    // Get the token from the request headers
    const token = request.headers.authorization.split(" ")[1]; // Assuming the token is sent in the Authorization header

    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
      if (err) {
        // Token verification failed
        console.error("Token verification failed:", err);
        return response.status(401).json({ message: "Unauthorized" });
      }

      // Token verified successfully, extract user_id
      const userId = decoded.user_id;

      // Insert into the database
      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
      const insertQuery = `
        INSERT INTO courses_info (user_id, course_name, course_description, subject_id, class_id)
        VALUES (?, ?, ?, ?, ?)
      `;
      const insertQueryPayload = [
        userId,
        courseName,
        courseDescription,
        subjectId,
        classId,
      ];

      connection.query(insertQuery, insertQueryPayload, (err, result) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );

        if (err) {
          console.error("Error executing database query:", err);
          return response.status(500).json({ error: err.message });
        }

        // Send a success response
        response.json({
          success: true,
          message: "Course created successfully",
        });
      });
    });
  } catch (error) {
    console.error("Error creating course:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to fetch all subjects
exports.fetchSubjects = function (request, response) {
  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
    const selectQuery = "SELECT subject_id, subject_name FROM subjects_info";

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      response.json({ subjects: rows });
    });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to fetch all classes
exports.fetchClasses = function (request, response) {
  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();
    const selectQuery = "SELECT class_id, class_name FROM classes_info";

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      response.json({ classes: rows });
    });
  } catch (error) {
    console.error("Error fetching classes:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

///////////////////////////
//------Admin Portal ------
///////////////////////////

// ----------School Related --------------

exports.fetchSchoolData = function (request, response) {
  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const selectQuery = `
      SELECT
        schools_info.school_id,
        schools_info.school_name,
        schools_info.principal_name,
        schools_info.contact_number,
        COUNT(login.user_id) AS total_users,
        SUM(CASE WHEN login.role = 'teacher' THEN 1 ELSE 0 END) AS total_teachers,
        SUM(CASE WHEN login.role = 'student' THEN 1 ELSE 0 END) AS total_students
      FROM schools_info
      LEFT JOIN login ON schools_info.school_id = login.school_id
      GROUP BY schools_info.school_id;
    `;

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("School Data:", rows);
      response.json({ schoolData: rows });
    });
  } catch (error) {
    console.error("Error fetching school data:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.fetchSchoolDetails = function (request, response) {
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT *
    FROM schools_info
    WHERE school_id = ?;
  `;

  connection.query(selectQuery, [schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("School Details:", rows[0]);
    response.json({ schoolDetails: rows[0] });
  });
};

exports.addSchool = function (request, response) {
  try {
    const {
      schoolName,
      schoolAddress,
      schoolDocumentNumber,
      principalName,
      city,
      state,
      zipCode,
      contactNumber,
      alternativeNumber,
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
      INSERT INTO schools_info (
        school_name,
        school_address,
        school_document_number,
        principal_name,
        city,
        state,
        zip_code,
        contact_number,
        alternative_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const insertQueryPayload = [
      schoolName,
      schoolAddress,
      schoolDocumentNumber,
      principalName,
      city,
      state,
      zipCode,
      contactNumber,
      alternativeNumber,
    ];

    connection.query(insertQuery, insertQueryPayload, (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("School added successfully");
      response.json({ message: "School added successfully" });
    });
  } catch (error) {
    console.error("Error adding school:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateSchool = function (request, response) {
  try {
    const {
      schoolId,
      schoolName,
      schoolAddress,
      schoolDocumentNumber,
      principalName,
      city,
      state,
      zipCode,
      contactNumber,
      alternativeNumber,
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const updateQuery = `
      UPDATE schools_info
      SET
        school_name = ?,
        school_address = ?,
        school_document_number = ?,
        principal_name = ?,
        city = ?,
        state = ?,
        zip_code = ?,
        contact_number = ?,
        alternative_number = ?
      WHERE school_id = ?;
    `;

    const updateQueryPayload = [
      schoolName,
      schoolAddress,
      schoolDocumentNumber,
      principalName,
      city,
      state,
      zipCode,
      contactNumber,
      alternativeNumber,
      schoolId,
    ];

    connection.query(updateQuery, updateQueryPayload, (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("School updated successfully");
      response.json({ message: "School updated successfully" });
    });
  } catch (error) {
    console.error("Error updating school:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteSchool = function (request, response) {
  try {
    const { schoolId } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const deleteQuery = `
      DELETE FROM schools_info
      WHERE school_id = ?;
    `;

    connection.query(deleteQuery, [schoolId], (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("School deleted successfully");
      response.json({ message: "School deleted successfully" });
    });
  } catch (error) {
    console.error("Error deleting school:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to fetch user counts for a specific school
exports.fetchUserCounts = function (request, response) {
  const schoolId = request.params.schoolId;

  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const selectQuery = `
      SELECT
        COUNT(login.user_id) AS total_users,
        SUM(CASE WHEN login.role = 'teacher' THEN 1 ELSE 0 END) AS total_teachers,
        SUM(CASE WHEN login.role = 'student' THEN 1 ELSE 0 END) AS total_students
      FROM login
      WHERE login.school_id = ?;
    `;

    connection.query(selectQuery, [schoolId], (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("User Counts:", rows[0]);
      response.json({ userCounts: rows[0] });
    });
  } catch (error) {
    console.error("Error fetching user counts:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------ Teacher Related -------------

exports.fetchTeachersForSchool = function (request, response) {
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
  SELECT
  login.user_id,
  login.school_id,
  login.sap_id,
  
  login.school_name,
  
  teachers_info.first_name,
  teachers_info.last_name,
  teachers_info.contact_number,
  teachers_info.email,
  teachers_info.birthday,
  GROUP_CONCAT(DISTINCT subjects_info.subject_name) AS subjects_taught,
  GROUP_CONCAT(DISTINCT classes_info.class_name) AS classes_taught
FROM
  login
LEFT JOIN teachers_info ON login.user_id = teachers_info.user_id
LEFT JOIN courses_info ON login.user_id = courses_info.user_id
LEFT JOIN subjects_info ON courses_info.subject_id = subjects_info.subject_id
LEFT JOIN chapters_info ON courses_info.course_id = chapters_info.course_id
LEFT JOIN classes_info ON courses_info.class_id = classes_info.class_id
WHERE
  login.school_id = ? AND login.role = 'teacher'
GROUP BY
  login.user_id, 
  login.school_id,
  login.sap_id,
  
  login.school_name,
  
  teachers_info.first_name,
  teachers_info.last_name,
  teachers_info.contact_number,
  teachers_info.email,
  teachers_info.birthday;
  
  `;

  connection.query(selectQuery, [schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Teachers for School:", rows);
    response.json({ teachersData: rows });
  });
};

exports.addTeacher = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  connection.beginTransaction(function (err) {
    if (err) {
      console.error("Error starting transaction:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }

    try {
      // ... (unchanged code)
      const {
        // teacher details from the form
        firstName,
        middleName,
        lastName,
        gender,
        birthday,
        email,
        contactNumber,
        alternativeNumber,
        aadharCardNumber,
        panCard,
        // address details
        permanentAddress,
        city,
        state,
        // family details
        fatherName,
        motherName,
        emergencyContactName,
        emergencyContactNumber,
      } = request.body;

      const schoolId = request.params.schoolId;

      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

      // Generate sap_id and password
      const sapId = generateRandomSapId();
      const password = sapId; // Assuming password should be the same as sap_id
      console.log("Generated SAP ID:", sapId);
      console.log("Generated Password:", password);

      const role = "teacher";

      const insertLoginQuery = `
          INSERT INTO login (school_id, sap_id, password, school_name, role, email)
          VALUES (?, ?, ?, (SELECT school_name FROM schools_info WHERE school_id = ?), ?, ?);
        `;

      const insertLoginPayload = [
        schoolId,
        sapId,
        password,
        schoolId,
        role,
        email,
      ];
      console.log("LOGIN ROWS: ", insertLoginPayload);

      connection.query(insertLoginQuery, insertLoginPayload, (err, result) => {
        if (err) {
          console.error("Error executing login query:", err);
          return connection.rollback(function () {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
              connection
            );
            response.status(500).json({ error: err.message });
          });
        }

        const insertTeacherQuery = `
            INSERT INTO teachers_info (
              user_id,
              first_name,
              middle_name,
              last_name,
              gender,
              birthday,
              email,
              contact_number,
              alternative_number,
              aadhar_card_number,
              pan_card,
              permanent_address,
              city,
              state,
              father_name,
              mother_name,
              emergency_contact_name,
              emergency_contact_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;

        const insertTeacherPayload = [
          result.insertId, // Use the ID generated in the login query
          firstName,
          middleName,
          lastName,
          gender,
          birthday,
          email,
          contactNumber,
          alternativeNumber,
          aadharCardNumber,
          panCard,
          permanentAddress,
          city,
          state,
          fatherName,
          motherName,
          emergencyContactName,
          emergencyContactNumber,
        ];

        connection.query(
          insertTeacherQuery,
          insertTeacherPayload,
          (err, result) => {
            if (err) {
              console.error("Error executing teacher query:", err);
              return connection.rollback(function () {
                connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                  connection
                );
                response.status(500).json({ error: err.message });
              });
            }

            connection.commit(function (err) {
              if (err) {
                console.error("Error committing transaction:", err);
                return connection.rollback(function () {
                  connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
                  response.status(500).json({ error: err.message });
                });
              }
            
              console.log("Transaction completed successfully");
            
              // Include the userId in the response
              const userId = result.insertId;
              
              // Close the connection only once after including userId in the response
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(connection);
            
              response.json({ message: "Teacher added successfully",  userId: result.insertId });
            });
          }
        );
      });
    } catch (error) {
      console.error("Error adding teacher:", error);
      connection.rollback(function () {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        response.status(500).json({ error: "Internal Server Error" });
      });
    }
  });
};

exports.fetchTeacherDetails = function (request, response) {
  const userId = request.params.userId; // Updated parameter name to userId
  const schoolId = request.params.schoolId; // Extract schoolId from URL

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
      SELECT
        login.*,
        teachers_info.*
      FROM login
      LEFT JOIN teachers_info ON login.user_id = teachers_info.user_id
      WHERE login.user_id = ? AND login.school_id = ?;
    `;

  connection.query(selectQuery, [userId, schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Teacher Details:", rows[0]);
    response.json({ teacherDetails: rows[0] });
  });
};

exports.updateTeacher = function (request, response) {
  try {
    const {
      userId,
      firstName,
      middleName,
      lastName,
      gender,
      birthday,
      email,
      contactNumber,
      alternativeNumber,
      aadharCardNumber,
      panCard,
      permanentAddress,
      city,
      state,
      fatherName,
      motherName,
      emergencyContactName,
      emergencyContactNumber,
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const updateQuery = `
      UPDATE teachers_info
      SET
        first_name = ?,
        middle_name = ?,
        last_name = ?,
        gender = ?,
        birthday = ?,
        email = ?,
        contact_number = ?,
        alternative_number = ?,
        aadhar_card_number = ?,
        pan_card = ?,
        permanent_address = ?,
        city = ?,
        state = ?,
        father_name = ?,
        mother_name = ?,
        emergency_contact_name = ?,
        emergency_contact_number = ?
      WHERE user_id = ?;
    `;

    const updatePayload = [
      firstName,
      middleName,
      lastName,
      gender,
      birthday,
      email,
      contactNumber,
      alternativeNumber,
      aadharCardNumber,
      panCard,
      permanentAddress,
      city,
      state,
      fatherName,
      motherName,
      emergencyContactName,
      emergencyContactNumber,
      userId,
    ];

    connection.query(updateQuery, updatePayload, (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("Teacher updated successfully");
      response.json({ message: "Teacher updated successfully" });
    });
  } catch (error) {
    console.error("Error updating teacher:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteTeacher = function (request, response) {
  try {
    const { userId } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const deleteTeachersQuery = `
      DELETE FROM teachers_info
      WHERE user_id = ?;
    `;

    const deleteLoginQuery = `
      DELETE FROM login
      WHERE user_id = ?;
    `;

    // Delete from teachers_info table
    connection.query(
      deleteTeachersQuery,
      [userId],
      (errTeachers, resultTeachers) => {
        if (errTeachers) {
          console.error(
            "Error deleting from teachers_info table:",
            errTeachers
          );
          return response.status(500).json({ error: errTeachers.message });
        }

        // Delete from login table
        connection.query(
          deleteLoginQuery,
          [userId],
          (errLogin, resultLogin) => {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
              connection
            );

            if (errLogin) {
              console.error("Error deleting from login table:", errLogin);
              return response.status(500).json({ error: errLogin.message });
            }

            console.log("Teacher deleted successfully");
            response.json({ message: "Teacher deleted successfully" });
          }
        );
      }
    );
  } catch (error) {
    console.error("Error deleting teacher:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// -------------- Student Related --------------

exports.fetchStudentsForSchool = function (request, response) {
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT
      login.user_id,
      login.sap_id,
      students_info.first_name,
      students_info.last_name,
      students_info.contact_number,
      students_info.father_name,
      students_info.mother_name,
      students_info.guardian_name,
      students_info.email,
      students_info.aadhar_card_number,
      students_info.permanent_address,
      students_info.city,
      students_info.state,
      students_info.account_number,
      mentors_info.mentor_first_name,
      mentors_info.mentor_last_name
    FROM
      login
    LEFT JOIN students_info ON login.user_id = students_info.user_id
    LEFT JOIN mentors_info ON mentors_info.mentor_id = students_info.mentor_id
    WHERE
      login.school_id = ? AND login.role = 'student';
  `;

  connection.query(selectQuery, [schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Students for School:", rows);
    response.json({ studentsData: rows });
  });
};

exports.addStudent = function (request, response) {
  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  connection.beginTransaction(function (err) {
    if (err) {
      console.error("Error starting transaction:", err);
      return response.status(500).json({ error: "Internal Server Error" });
    }

    try {
      const {
        // student details from the form
        firstName,
        middleName,
        lastName,
        gender,
        birthday,
        email,
        contactNumber,
        alternativeNumber,
        aadharCardNumber,
        // address details
        permanentAddress,
        city,
        state,
        // family details
        fatherName,
        fatherContactNumber,
        fatherEmail,
        motherName,
        motherContactNumber,
        motherEmail,
        guardianName,
        guardianNumber,
        guardianEmail,
        // account details
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        accountType,
        // Mentor Id
        mentorId,
      } = request.body;
      console.log("Add Student Data : ", request.body);

      const schoolId = request.params.schoolId;

      const connection =
        connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

      // Generate sap_id and password
      const sapId = generateRandomSapId();
      const password = sapId;
      console.log("Generated SAP ID:", sapId);
      console.log("Generated Password:", password);

      const role = "student";

      const insertLoginQuery = `
        INSERT INTO login (school_id, sap_id, password, school_name, role, email)
        VALUES (?, ?, ?, (SELECT school_name FROM schools_info WHERE school_id = ?), ?, ?);
      `;

      const insertLoginPayload = [
        schoolId,
        sapId,
        password,
        schoolId,
        role,
        email,
      ];
      console.log("STUDENT LOGIN DATA: ", insertLoginPayload);

      connection.query(insertLoginQuery, insertLoginPayload, (err, result) => {
        if (err) {
          console.error("Error executing login query:", err);
          return connection.rollback(function () {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
              connection
            );
            response.status(500).json({ error: err.message });
          });
        }

        const insertStudentQuery = `
            INSERT INTO students_info (
              user_id,
              first_name,
              middle_name,
              last_name,
              gender,
              birthday,
              email,
              contact_number,
              alternative_number,
              aadhar_card_number,
              permanent_address,
              city,
              state,
              father_name,
              father_contact_number,
              father_email,
              mother_name,
              mother_contact_number,
              mother_email,
              guardian_name,
              guardian_number,
              guardian_email,
              account_holder_name,
              bank_name,
              account_number,
              ifsc_code,
              account_type,
              mentor_id 
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;

        const insertStudentPayload = [
          result.insertId, // Use the ID generated in the login query
          firstName,
          middleName,
          lastName,
          gender,
          birthday,
          email,
          contactNumber,
          alternativeNumber,
          aadharCardNumber,
          permanentAddress,
          city,
          state,
          fatherName,
          fatherContactNumber,
          fatherEmail,
          motherName,
          motherContactNumber,
          motherEmail,
          guardianName,
          guardianNumber,
          guardianEmail,
          accountHolderName,
          bankName,
          accountNumber,
          ifscCode,
          accountType,
          mentorId,
        ];

        connection.query(
          insertStudentQuery,
          insertStudentPayload,
          (err, result) => {
            if (err) {
              console.error("Error executing student query:", err);
              return connection.rollback(function () {
                connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                  connection
                );
                response.status(500).json({ error: err.message });
              });
            }

            connection.commit(function (err) {
              if (err) {
                console.error("Error committing transaction:", err);
                return connection.rollback(function () {
                  connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                    connection
                  );
                  response.status(500).json({ error: err.message });
                });
              }

              console.log("Transaction completed successfully");
              connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
                connection
              );
              response.json({ message: "Student added successfully" });
            });
          }
        );
        // });
      });
    } catch (error) {
      console.error("Error adding student:", error);
      connection.rollback(function () {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );
        response.status(500).json({ error: "Internal Server Error" });
      });
    }
  });
};

exports.fetchStudentDetails = function (request, response) {
  const userId = request.params.userId;
  const schoolId = request.params.schoolId;

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT
      login.*,
      students_info.*
    FROM login
    LEFT JOIN students_info ON login.user_id = students_info.user_id
    WHERE login.user_id = ? AND login.school_id = ?;
  `;

  connection.query(selectQuery, [userId, schoolId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Student Details:", rows[0]);
    response.json({ studentDetails: rows[0] });
  });
};

exports.updateStudent = function (request, response) {
  try {
    const {
      // student details from the form
      firstName,
      middleName,
      lastName,
      gender,
      birthday,
      email,
      contactNumber,
      alternativeNumber,
      aadharCardNumber,
      // address details
      permanentAddress,
      city,
      state,
      // family details
      fatherName,
      fatherContactNumber,
      fatherEmail,
      motherName,
      motherContactNumber,
      motherEmail,
      guardianName,
      guardianNumber,
      guardianEmail,
      // account details
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      accountType,
      // Mentor Id
      mentorId,
      userId, // User ID of the student to update
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const updateStudentQuery = `
      UPDATE students_info
      SET
        first_name = ?,
        middle_name = ?,
        last_name = ?,
        gender = ?,
        birthday = ?,
        email = ?,
        contact_number = ?,
        alternative_number = ?,
        aadhar_card_number = ?,
        permanent_address = ?,
        city = ?,
        state = ?,
        father_name = ?,
        father_contact_number = ?,
        father_email = ?,
        mother_name = ?,
        mother_contact_number = ?,
        mother_email = ?,
        guardian_name = ?,
        guardian_number = ?,
        guardian_email = ?,
        account_holder_name = ?,
        bank_name = ?,
        account_number = ?,
        ifsc_code = ?,
        account_type = ?,
        mentor_id = ?
      WHERE user_id = ?;
    `;

    const updateStudentPayload = [
      firstName,
      middleName,
      lastName,
      gender,
      birthday,
      email,
      contactNumber,
      alternativeNumber,
      aadharCardNumber,
      permanentAddress,
      city,
      state,
      fatherName,
      fatherContactNumber,
      fatherEmail,
      motherName,
      motherContactNumber,
      motherEmail,
      guardianName,
      guardianNumber,
      guardianEmail,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      accountType,
      mentorId,
      userId,
    ];

    connection.query(
      updateStudentQuery,
      updateStudentPayload,
      (err, result) => {
        connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
          connection
        );

        if (err) {
          console.error("Error executing update student query:", err);
          return response.status(500).json({ error: err.message });
        }

        console.log("Student updated successfully");
        response.json({ message: "Student updated successfully" });
      }
    );
  } catch (error) {
    console.error("Error updating student:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteStudent = function (request, response) {
  try {
    const { userId } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const deleteStudentsQuery = `
      DELETE FROM students_info
      WHERE user_id = ?;
    `;

    const deleteLoginQuery = `
      DELETE FROM login
      WHERE user_id = ?;
    `;

    // Delete from students_info table
    connection.query(
      deleteStudentsQuery,
      [userId],
      (errStudents, resultStudents) => {
        if (errStudents) {
          console.error(
            "Error deleting from students_info table:",
            errStudents
          );
          return response.status(500).json({ error: errStudents.message });
        }

        // Delete from login table
        connection.query(
          deleteLoginQuery,
          [userId],
          (errLogin, resultLogin) => {
            connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
              connection
            );

            if (errLogin) {
              console.error("Error deleting from login table:", errLogin);
              return response.status(500).json({ error: errLogin.message });
            }

            console.log("Student deleted successfully");
            response.json({ message: "Student deleted successfully" });
          }
        );
      }
    );
  } catch (error) {
    console.error("Error deleting student:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

function generateRandomSapId() {
  const length = 10;
  const characters = "0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

// --------------- Mentor Related --------------------

exports.fetchAllMentorsData = function (request, response) {
  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const selectQuery = `
      SELECT *
      FROM mentors_info;
    `;

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("Mentors Data:", rows);
      response.json({ mentorsData: rows });
    });
  } catch (error) {
    console.error("Error fetching mentors data:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.addMentor = function (request, response) {
  try {
    const {
      mentorFirstName,
      mentorMiddleName,
      mentorLastName,
      email,
      aadharCard,
      birthdate,
      contactNumber,
      alternativeContactNumber,
      permanentAddress,
      city,
      state,
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const insertQuery = `
      INSERT INTO mentors_info (
        mentor_first_name,
        mentor_middle_name,
        mentor_last_name,
        email,
        aadhar_card,
        birthdate,
        contact_number,
        alternative_contact_number,
        permanent_address,
        city,
        state
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const insertQueryPayload = [
      mentorFirstName,
      mentorMiddleName,
      mentorLastName,
      email,
      aadharCard,
      birthdate,
      contactNumber,
      alternativeContactNumber,
      permanentAddress,
      city,
      state,
    ];

    connection.query(insertQuery, insertQueryPayload, (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("Mentor added successfully");
      response.json({ message: "Mentor added successfully" });
    });
  } catch (error) {
    console.error("Error adding mentor:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to fetch all mentors' names and IDs
exports.fetchMentors = function (request, response) {
  try {
    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const selectQuery =
      'SELECT mentor_id, CONCAT(mentor_first_name, " ", mentor_last_name) AS mentor_name FROM mentors_info';

    connection.query(selectQuery, (err, rows, fields) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      response.json({ mentors: rows });
    });
  } catch (error) {
    console.error("Error fetching mentors:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateMentor = function (request, response) {
  try {
    const {
      mentorId,
      mentorFirstName,
      mentorMiddleName,
      mentorLastName,
      email,
      aadharCard,
      birthdate,
      contactNumber,
      alternativeContactNumber,
      permanentAddress,
      city,
      state,
    } = request.body;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const updateQuery = `
      UPDATE mentors_info
      SET
        mentor_first_name = ?,
        mentor_middle_name = ?,
        mentor_last_name = ?,
        email = ?,
        aadhar_card = ?,
        birthdate = ?,
        contact_number = ?,
        alternative_contact_number = ?,
        permanent_address = ?,
        city = ?,
        state = ?
      WHERE mentor_id = ?;
    `;

    const updatePayload = [
      mentorFirstName,
      mentorMiddleName,
      mentorLastName,
      email,
      aadharCard,
      birthdate,
      contactNumber,
      alternativeContactNumber,
      permanentAddress,
      city,
      state,
      mentorId,
    ];

    connection.query(updateQuery, updatePayload, (err, result) => {
      connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
        connection
      );

      if (err) {
        console.error("Error executing database query:", err);
        return response.status(500).json({ error: err.message });
      }

      console.log("Mentor updated successfully");
      response.json({ message: "Mentor updated successfully" });
    });
  } catch (error) {
    console.error("Error updating mentor:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteMentor = function (request, response) {
  try {
    const mentorId = request.body.mentorId;

    const connection =
      connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

    const deleteMentorQuery = `
      DELETE FROM mentors_info
      WHERE mentor_id = ?;
    `;

    const deleteStudentsQuery = `
      DELETE FROM students_info
      WHERE mentor_id = ?;
    `;

    // Start a transaction
    connection.beginTransaction(function (err) {
      if (err) {
        console.error("Error starting transaction:", err);
        return response.status(500).json({ error: err.message });
      }

      // Delete from mentors_info table
      connection.query(
        deleteMentorQuery,
        [mentorId],
        function (errMentor, resultMentor) {
          if (errMentor) {
            return connection.rollback(function () {
              console.error(
                "Error deleting from mentors_info table:",
                errMentor
              );
              response.status(500).json({ error: errMentor.message });
            });
          }

          // Delete from students_info table
          connection.query(
            deleteStudentsQuery,
            [mentorId],
            function (errStudents, resultStudents) {
              if (errStudents) {
                return connection.rollback(function () {
                  console.error(
                    "Error deleting students associated with mentor:",
                    errStudents
                  );
                  response.status(500).json({ error: errStudents.message });
                });
              }

              // Commit the transaction if everything is successful
              connection.commit(function (err) {
                if (err) {
                  return connection.rollback(function () {
                    console.error("Error committing transaction:", err);
                    response.status(500).json({ error: err.message });
                  });
                }

                console.log(
                  "Mentor and associated students deleted successfully"
                );
                response.json({
                  message:
                    "Mentor and associated students deleted successfully",
                });
              });
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Error deleting mentor:", error);
    response.status(500).json({ error: "Internal Server Error" });
  }
};

exports.fetchMentorDetails = function (request, response) {
  const mentorId = request.params.mentorId; // Updated parameter name to mentorId

  const connection =
    connectionProvider.mysqlConnectionStringProvider.getMysqlConnection();

  const selectQuery = `
    SELECT *
    FROM mentors_info
    WHERE mentor_id = ?;
  `;

  connection.query(selectQuery, [mentorId], (err, rows, fields) => {
    connectionProvider.mysqlConnectionStringProvider.closeMysqlConnection(
      connection
    );

    if (err) {
      console.error("Error executing database query:", err);
      return response.status(500).json({ error: err.message });
    }

    console.log("Mentor Details:", rows[0]);
    response.json({ mentorDetails: rows[0] });
  });
};

// ------------------------Working Code ---------------------------------------

// ------------------------Testing Code ---------------------------------------
