import db from "../models/index.js";
import bcrypt from "bcryptjs";
import { requireSystemAdmin } from "../authorization/accessControl.js";

const User = db.user;
const Person = db.person;
const SALT_ROUNDS = 10;
const exports = {};

exports.findAll = async (_req, res) => {
  try {
    const data = await User.findAll({ order: [["email", "ASC"]] });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { email, password, isAdmin } = req.body;
    if (!email?.trim() || !password || password.length < 8) {
      return res.status(400).send({ message: "Email and password (min 8 chars) are required." });
    }
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email: email.trim().toLowerCase(),
      password: hash,
      isAdmin: !!isAdmin,
    });
    res.send(user);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.linkPerson = async (req, res) => {
  try {
    const { personId } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).send({ message: "User not found." });
    await Person.update({ userId: null }, { where: { userId: user.id } });
    if (personId) {
      await Person.update({ userId: user.id }, { where: { id: personId } });
    }
    res.send({ message: "User linked to person." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
