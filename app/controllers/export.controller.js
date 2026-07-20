import db from "../models/index.js";
import { canAccessTrip } from "../authorization/accessControl.js";
import { toCsv, sendCsv } from "../utils/csvExport.js";

const TripPeopleRole = db.tripPeopleRole;
const TripDonation = db.tripDonation;
const TripWorkerRole = db.tripWorkerRole;
const Donor = db.donor;
const Person = db.person;

const exports = {};

const assertTripAccess = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return { ok: false, status: 404, message: "Trip not found." };
  return { ok: true, trip: access.trip };
};

const yesNo = (value) => (value ? "Yes" : "No");

const licenseLabel = (value) => {
  if (value === "yes") return "Yes";
  if (value === "yes_retired") return "Yes, retired";
  if (value === "no") return "No";
  return "";
};

const formatPhone = (countryCode, number) =>
  [countryCode, number].filter((part) => part != null && String(part).trim() !== "").join(" ");

const joinValues = (values) =>
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("; ");

const PARTICIPANT_COLUMNS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "addLine1", label: "Address Line 1" },
  { key: "addLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state_prov", label: "State/Province" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
  { key: "phone", label: "Phone" },
  { key: "birthDate", label: "Birthdate" },
  { key: "gender", label: "Gender" },
  { key: "emergencyContactName", label: "Emergency Contact Name" },
  { key: "emergencyContactPhone", label: "Emergency Contact Phone" },
  { key: "hasAllergies", label: "Has Allergies" },
  { key: "allergiesDescription", label: "Allergies Description" },
  { key: "takesMedication", label: "Takes Medication" },
  { key: "currentChurchHome", label: "Current Church Home" },
  { key: "currentChurchHomeCity", label: "Church City" },
  { key: "currentChurchHomeStateProv", label: "Church State/Province" },
  { key: "bioText", label: "Bio" },
  { key: "documents", label: "Documents" },
  { key: "role", label: "Trip Role" },
  { key: "workerRole", label: "Worker Role" },
  { key: "status", label: "Status" },
  { key: "participantCost", label: "Participant Cost" },
  { key: "donationTotal", label: "Total Donations" },
  { key: "funding", label: "Funding" },
  { key: "licenseStatus", label: "License Status" },
  { key: "hasPreferredRoommate", label: "Has Preferred Roommate" },
  { key: "preferredRoommateNames", label: "Preferred Roommate Names" },
  { key: "travelOptions", label: "Travel Options" },
  { key: "agreementAccepted", label: "Agreement Accepted" },
  { key: "agreementSignatureName", label: "Agreement Signature" },
  { key: "agreementDate", label: "Agreement Date" },
  { key: "agreementAdultName", label: "Adult Signer Name" },
  { key: "agreementAdultEmail", label: "Adult Signer Email" },
  { key: "agreementAdultRelationship", label: "Adult Signer Relationship" },
  { key: "whygoText", label: "Why Go" },
  { key: "assiginmentDateTime", label: "Assignment Date" },
];

exports.participantsCsv = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const access = await assertTripAccess(req, tripId);
    if (!access.ok) return res.status(access.status).send({ message: access.message });

    const rows = await TripPeopleRole.findAll({
      where: { tripId },
      include: [
        { model: Person, as: "person" },
        { model: db.role, as: "role" },
        {
          model: TripWorkerRole,
          as: "tripWorkerRole",
          include: [{ model: db.workerRole, as: "workerRole", attributes: ["id", "name"] }],
        },
      ],
      order: [
        [{ model: Person, as: "person" }, "lastName", "ASC"],
        [{ model: Person, as: "person" }, "firstName", "ASC"],
      ],
    });

    const personIds = [...new Set(rows.map((r) => Number(r.peopleId)).filter(Boolean))];
    const assignmentIds = rows.map((r) => Number(r.id)).filter(Boolean);

    const documents = personIds.length
      ? await db.personDocument.findAll({
          where: { personId: personIds },
          include: [
            {
              model: db.documentType,
              as: "documentType",
              attributes: ["id", "description", "type"],
            },
          ],
        })
      : [];
    const documentsByPersonId = new Map();
    for (const doc of documents) {
      const id = Number(doc.personId);
      if (!documentsByPersonId.has(id)) documentsByPersonId.set(id, []);
      documentsByPersonId.get(id).push(doc);
    }

    const optionRows = assignmentIds.length
      ? await db.tripPeopleRoleOption.findAll({
          where: { tripPeopleRoleId: assignmentIds, selected: true },
          include: [
            {
              model: db.tripTravelOption,
              as: "tripTravelOption",
              attributes: ["id", "description", "setNumber", "priceAdjustment"],
            },
          ],
        })
      : [];
    const optionsByAssignmentId = new Map();
    for (const opt of optionRows) {
      const id = Number(opt.tripPeopleRoleId);
      if (!optionsByAssignmentId.has(id)) optionsByAssignmentId.set(id, []);
      optionsByAssignmentId.get(id).push(opt);
    }

    const totals = await TripDonation.findAll({
      attributes: ["personId", [db.sequelize.fn("SUM", db.sequelize.col("amount")), "donationTotal"]],
      where: { tripId, personId: { [db.Sequelize.Op.ne]: null } },
      group: ["personId"],
      raw: true,
    });
    const totalsByPersonId = new Map(
      totals.map((row) => [Number(row.personId), Number(row.donationTotal) || 0])
    );

    const csvRows = rows.map((r) => {
      const person = r.person || {};
      const funding = [];
      if (r.willSelfFund) funding.push("Self-fund");
      if (r.willRaiseFunds) funding.push("Raise funds");

      const selectedOptions = (optionsByAssignmentId.get(Number(r.id)) || [])
        .filter((opt) => opt.tripTravelOption)
        .map((opt) => {
          const option = opt.tripTravelOption;
          const setLabel = option.setNumber != null ? `Set ${option.setNumber}: ` : "";
          const price =
            option.priceAdjustment != null && Number(option.priceAdjustment) !== 0
              ? ` (${Number(option.priceAdjustment) > 0 ? "+" : ""}${option.priceAdjustment})`
              : "";
          return `${setLabel}${option.description || ""}${price}`.trim();
        });

      const personDocs = documentsByPersonId.get(Number(r.peopleId)) || [];
      const documentLabels = personDocs.map((doc) => {
        const typeName = doc.documentType?.description || doc.documentType?.type || "Document";
        const expires = doc.expirationDate ? ` expires ${doc.expirationDate}` : "";
        return `${typeName}${expires}`.trim();
      });

      const adultName = [r.agreementAdultFirstName, r.agreementAdultLastName]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");

      return {
        firstName: person.firstName || "",
        lastName: person.lastName || "",
        email: person.email || "",
        addLine1: person.addLine1 || "",
        addLine2: person.addLine2 || "",
        city: person.city || "",
        state_prov: person.state_prov || "",
        postalCode: person.postalCode || "",
        country: person.country || "",
        phone: formatPhone(person.phoneContryCode, person.phoneNumber),
        birthDate: person.birthDate || "",
        gender: person.gender || "",
        emergencyContactName: person.emergencyContactName || "",
        emergencyContactPhone: formatPhone(
          person.emergencyContactPhoneCountryCode,
          person.emergencyContactPhoneNumber
        ),
        hasAllergies: yesNo(person.hasAllergies),
        allergiesDescription: person.allergiesDescription || "",
        takesMedication: yesNo(person.takesMedication),
        currentChurchHome: person.currentChurchHome || "",
        currentChurchHomeCity: person.currentChurchHomeCity || "",
        currentChurchHomeStateProv: person.currentChurchHomeStateProv || "",
        bioText: person.bioText || "",
        documents: joinValues(documentLabels),
        role: r.role?.roleName || "",
        workerRole: r.tripWorkerRole?.workerRole?.name || "",
        status: r.status || "",
        participantCost: r.participantCost ?? "",
        donationTotal: totalsByPersonId.get(Number(r.peopleId)) || 0,
        funding: joinValues(funding),
        licenseStatus: licenseLabel(r.licenseStatus),
        hasPreferredRoommate: yesNo(r.hasPreferredRoommate),
        preferredRoommateNames: r.preferredRoommateNames || "",
        travelOptions: joinValues(selectedOptions),
        agreementAccepted: yesNo(r.agreementAccepted),
        agreementSignatureName: r.agreementSignatureName || "",
        agreementDate: r.agreementDate || "",
        agreementAdultName: adultName,
        agreementAdultEmail: r.agreementAdultEmail || "",
        agreementAdultRelationship: r.agreementAdultRelationship || "",
        whygoText: r.whygoText || "",
        assiginmentDateTime: r.assiginmentDateTime || "",
      };
    });

    const csv = toCsv(csvRows, PARTICIPANT_COLUMNS);
    sendCsv(res, `trip-${tripId}-participants.csv`, csv);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.donorsCsv = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const access = await assertTripAccess(req, tripId);
    if (!access.ok) return res.status(access.status).send({ message: access.message });

    const donations = await TripDonation.findAll({
      where: { tripId },
      include: [{ model: Donor, as: "donor" }],
    });
    const donorMap = new Map();
    donations.forEach((d) => {
      if (d.donor) donorMap.set(d.donor.id, d.donor);
    });
    const csvRows = [...donorMap.values()].map((d) => ({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      city: d.city,
      state_prov: d.state_prov,
      status: d.status,
    }));
    const csv = toCsv(csvRows, [
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "state_prov", label: "State/Prov" },
      { key: "status", label: "Status" },
    ]);
    sendCsv(res, `trip-${tripId}-donors.csv`, csv);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.donationsCsv = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const access = await assertTripAccess(req, tripId);
    if (!access.ok) return res.status(access.status).send({ message: access.message });

    const donations = await TripDonation.findAll({
      where: { tripId },
      include: [
        { model: Person, as: "participant", attributes: ["firstName", "lastName"] },
        { model: Donor, as: "donor" },
      ],
      order: [["dateTime", "DESC"]],
    });
    const csvRows = donations.map((d) => ({
      amount: d.amount,
      dateTime: d.dateTime,
      participant: d.participant ? `${d.participant.firstName} ${d.participant.lastName}` : "",
      donor: d.donor
        ? `${d.donor.firstName || ""} ${d.donor.lastName || ""}`.trim()
        : "",
      donorEmail: d.donor?.email || "",
    }));
    const csv = toCsv(csvRows, [
      { key: "amount", label: "Amount" },
      { key: "dateTime", label: "Date" },
      { key: "participant", label: "Participant" },
      { key: "donor", label: "Donor" },
      { key: "donorEmail", label: "Donor Email" },
    ]);
    sendCsv(res, `trip-${tripId}-donations.csv`, csv);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
