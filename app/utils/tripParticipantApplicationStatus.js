import db from "../models/index.js";

const Person = db.person;
const TripWorkerRole = db.tripWorkerRole;
const WorkerRole = db.workerRole;

const LICENSE_STATUSES = ["yes", "yes_retired", "no"];

const isBlank = (value) => value == null || String(value).trim() === "";

/** Age under 18 as of a given date (defaults to today). */
export const isUnder18 = (birthDate, asOf = new Date()) => {
  if (!birthDate) return false;
  const raw = String(birthDate).slice(0, 10);
  const parts = raw.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return false;
  const [y, m, d] = parts;
  const birth = new Date(y, m - 1, d);
  const ref = asOf instanceof Date ? asOf : new Date(asOf);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return false;
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) age -= 1;
  return age < 18;
};

const PROFILE_FIELD_CHECKS = [
  { key: "firstName" },
  { key: "lastName" },
  { key: "email" },
  { key: "addLine1" },
  { key: "city" },
  { key: "country" },
  { key: "state_prov" },
  { key: "postalCode" },
  { key: "phoneContryCode" },
  { key: "phoneNumber" },
  { key: "birthDate" },
  { key: "gender" },
  { key: "emergencyContactName" },
  { key: "emergencyContactPhoneCountryCode" },
  { key: "emergencyContactPhoneNumber" },
  {
    key: "allergiesDescription",
    required: (person) => !!person?.hasAllergies,
  },
  { key: "currentChurchHome" },
  { key: "currentChurchHomeCity" },
  { key: "currentChurchHomeStateProv" },
];

export const isProfileComplete = (person) => {
  if (!person) return false;
  return PROFILE_FIELD_CHECKS.every((field) => {
    const required = field.required ? field.required(person) : true;
    if (!required) return true;
    return !isBlank(person[field.key]);
  });
};

export const isApplicationComplete = ({
  tripWorkerRoleId,
  willSelfFund,
  willRaiseFunds,
  licenseStatus,
  hasPreferredRoommate,
  preferredRoommateNames,
  licenseRequired = false,
  agreementRequired = false,
  agreementAccepted = false,
  agreementSignatureName = null,
  participantUnder18 = false,
  agreementAdultFirstName = null,
  agreementAdultLastName = null,
  agreementAdultEmail = null,
  agreementAdultRelationship = null,
}) => {
  if (tripWorkerRoleId == null || tripWorkerRoleId === "") return false;
  if (!willSelfFund && !willRaiseFunds) return false;
  if (licenseRequired && !LICENSE_STATUSES.includes(licenseStatus)) return false;
  if (hasPreferredRoommate && isBlank(preferredRoommateNames)) return false;
  if (agreementRequired) {
    if (!agreementAccepted) return false;
    if (isBlank(agreementSignatureName)) return false;
    if (participantUnder18) {
      if (isBlank(agreementAdultFirstName)) return false;
      if (isBlank(agreementAdultLastName)) return false;
      if (isBlank(agreementAdultEmail)) return false;
      if (isBlank(agreementAdultRelationship)) return false;
    }
  }
  return true;
};

export const resolveReadyOrIncompleteStatus = ({
  person,
  tripWorkerRoleId,
  willSelfFund,
  willRaiseFunds,
  licenseStatus,
  hasPreferredRoommate,
  preferredRoommateNames,
  licenseRequired = false,
  agreementRequired = false,
  agreementAccepted = false,
  agreementSignatureName = null,
  agreementAdultFirstName = null,
  agreementAdultLastName = null,
  agreementAdultEmail = null,
  agreementAdultRelationship = null,
}) => {
  const participantUnder18 = isUnder18(person?.birthDate);
  const applicationOk = isApplicationComplete({
    tripWorkerRoleId,
    willSelfFund,
    willRaiseFunds,
    licenseStatus,
    hasPreferredRoommate,
    preferredRoommateNames,
    licenseRequired,
    agreementRequired,
    agreementAccepted,
    agreementSignatureName,
    participantUnder18,
    agreementAdultFirstName,
    agreementAdultLastName,
    agreementAdultEmail,
    agreementAdultRelationship,
  });
  const profileOk = isProfileComplete(person);
  return applicationOk && profileOk ? "ready" : "incomplete";
};

export const loadPersonForCompleteness = async (peopleId) => {
  if (!peopleId) return null;
  return Person.findByPk(peopleId);
};

export const loadLicenseRequired = async (tripWorkerRoleId) => {
  if (tripWorkerRoleId == null || tripWorkerRoleId === "") return false;
  const row = await TripWorkerRole.findByPk(tripWorkerRoleId, {
    include: [
      {
        model: WorkerRole,
        as: "workerRole",
        attributes: ["id", "licenseRequired"],
      },
    ],
  });
  return !!row?.workerRole?.licenseRequired;
};

/** Statuses that admins set manually; do not auto-overwrite. */
export const MANUAL_TRIP_PARTICIPANT_STATUSES = ["approved", "denied", "canceled"];

export const shouldAutoSetApplicationStatus = (status) =>
  status == null ||
  status === "" ||
  status === "incomplete" ||
  status === "ready" ||
  status === "applied";
