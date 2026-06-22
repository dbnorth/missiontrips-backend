import "dotenv/config";
import bcrypt from "bcryptjs";
import db from "../models/index.js";

const roles = [
  { roleName: "Org Admin", roleDescription: "Organization administrator" },
  { roleName: "Trip Leader", roleDescription: "Leader for a specific trip" },
  { roleName: "Trip Participant", roleDescription: "Participant on a trip" },
  { roleName: "Pending User", roleDescription: "Awaiting organization approval" },
];

const run = async () => {
  try {
    await db.sequelize.authenticate();
    for (const r of roles) {
      const existing = await db.role.findOne({ where: { roleName: r.roleName } });
      if (!existing) await db.role.create(r);
    }

    const adminEmail = "admin@missiontrips.local";
    let admin = await db.user.unscoped().findOne({ where: { email: adminEmail } });
    if (!admin) {
      admin = await db.user.create({
        email: adminEmail,
        password: await bcrypt.hash("admin12345", 10),
        isAdmin: true,
        passwordSetByUser: true,
      });
      console.log(`Created admin user: ${adminEmail} / admin12345`);
    } else if (!admin.passwordSetByUser) {
      await admin.update({ passwordSetByUser: true });
    }

    console.log("Seed complete.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
