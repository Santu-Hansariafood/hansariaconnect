const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Import Admin model
const Admin = require("../models/admin/Admin").default;

const DEFAULT_SUPER_ADMIN = {
  userId: "superadmin",
  email: "superadmin@example.com",
  password: "SuperAdmin123!",
  isSuperAdmin: true,
};

const DEFAULT_ADMIN = {
  userId: "admin",
  email: "admin@example.com",
  password: "Admin123!",
  isSuperAdmin: false,
};

async function seedAdmins() {
  try {
    // Connect to the database
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL);
    console.log("Connected to database!");

    // Delete existing admins first
    await Admin.deleteMany({});
    console.log("Deleted existing admin users!");

    // Hash passwords manually
    const saltRounds = 10;
    const hashedSuperPassword = await bcrypt.hash(DEFAULT_SUPER_ADMIN.password, saltRounds);
    const hashedAdminPassword = await bcrypt.hash(DEFAULT_ADMIN.password, saltRounds);

    // Create the admins
    const superAdminResult = await Admin.create({
      ...DEFAULT_SUPER_ADMIN,
      password: hashedSuperPassword,
    });
    const adminResult = await Admin.create({
      ...DEFAULT_ADMIN,
      password: hashedAdminPassword,
    });

    console.log("Super Admin created successfully:", superAdminResult.userId);
    console.log("Admin created successfully:", adminResult.userId);

    // Verify passwords work
    const testSuper = await Admin.findOne({ userId: "superadmin" });
    if (testSuper) {
      const testPass = await testSuper.comparePassword(DEFAULT_SUPER_ADMIN.password);
      console.log("Super Admin password test passed:", testPass);
    }
    const testAdmin = await Admin.findOne({ userId: "admin" });
    if (testAdmin) {
      const testPass = await testAdmin.comparePassword(DEFAULT_ADMIN.password);
      console.log("Admin password test passed:", testPass);
    }

    console.log("\nLogin credentials:");
    console.log("Super Admin:");
    console.log("- User ID:", DEFAULT_SUPER_ADMIN.userId);
    console.log("- Email:", DEFAULT_SUPER_ADMIN.email);
    console.log("- Password:", DEFAULT_SUPER_ADMIN.password);
    console.log("\nAdmin:");
    console.log("- User ID:", DEFAULT_ADMIN.userId);
    console.log("- Email:", DEFAULT_ADMIN.email);
    console.log("- Password:", DEFAULT_ADMIN.password);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding admins:", error);
    process.exit(1);
  }
}

seedAdmins();
