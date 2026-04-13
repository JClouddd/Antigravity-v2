import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPlaidClient } from "@/lib/plaidClient";

export async function POST(req) {
  try {
    const { userId, profileId } = await req.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const pId = profileId || "personal";
    const adminDb = getAdminDb();
    if (!adminDb) return Response.json({ error: "Admin DB not configured" }, { status: 500 });

    // Get all active Plaid items
    const itemsSnap = await adminDb.collection("users").doc(userId)
      .collection("finance_profiles").doc(pId)
      .collection("plaid_items").where("status", "==", "active").get();

    if (itemsSnap.empty) {
      return Response.json({ credit: [], student: [], mortgage: [], message: "No linked accounts" });
    }

    const { client: plaidClient, env } = await getPlaidClient(userId);

    let allCredit = [];
    let allStudent = [];
    let allMortgage = [];

    for (const plaidDoc of itemsSnap.docs) {
      const { accessToken, institutionName } = plaidDoc.data();

      try {
        const response = await plaidClient.liabilitiesGet({
          access_token: accessToken,
        });

        // Credit cards
        const credit = (response.data.liabilities?.credit || []).map(c => ({
          id: c.account_id,
          aprs: (c.aprs || []).map(a => ({
            type: a.apr_type,
            percentage: a.apr_percentage,
            balanceSubjectToApr: a.balance_subject_to_apr,
          })),
          isOverdue: c.is_overdue,
          lastPaymentAmount: c.last_payment_amount,
          lastPaymentDate: c.last_payment_date,
          lastStatementBalance: c.last_statement_balance,
          lastStatementDate: c.last_statement_issue_date,
          minimumPayment: c.minimum_payment_amount,
          nextPaymentDue: c.next_payment_due_date,
          institution: institutionName,
        }));

        // Student loans
        const student = (response.data.liabilities?.student || []).map(s => ({
          id: s.account_id,
          name: s.loan_name,
          interestRate: s.interest_rate_percentage,
          status: s.loan_status?.type || "unknown",
          originationDate: s.origination_date,
          originalPrincipal: s.origination_principal_amount,
          outstandingBalance: s.outstanding_interest_amount,
          lastPaymentAmount: s.last_payment_amount,
          lastPaymentDate: s.last_payment_date,
          minimumPayment: s.minimum_payment_amount,
          nextPaymentDue: s.next_payment_due_date,
          expectedPayoff: s.expected_payoff_date,
          servicerName: s.servicer_address?.name || "",
          repaymentPlan: s.repayment_plan?.type || "",
          institution: institutionName,
        }));

        // Mortgages
        const mortgage = (response.data.liabilities?.mortgage || []).map(m => ({
          id: m.account_id,
          type: m.loan_type_description || m.loan_term,
          interestRate: m.interest_rate?.percentage,
          interestType: m.interest_rate?.type,
          originationDate: m.origination_date,
          originalPrincipal: m.origination_principal_amount,
          currentBalance: m.last_payment_amount,
          lastPaymentDate: m.last_payment_date,
          maturityDate: m.maturity_date,
          nextPaymentDue: m.next_payment_due_date,
          nextPaymentAmount: m.next_monthly_payment,
          pastDue: m.past_due_amount,
          propertyAddress: m.property_address,
          ytdInterestPaid: m.ytd_interest_paid,
          ytdPrincipalPaid: m.ytd_principal_paid,
          institution: institutionName,
        }));

        allCredit.push(...credit);
        allStudent.push(...student);
        allMortgage.push(...mortgage);
      } catch (plaidErr) {
        if (plaidErr?.response?.data?.error_code === "PRODUCTS_NOT_SUPPORTED") {
          console.log(`[PLAID] Liabilities not supported for ${institutionName}`);
        } else {
          console.error(`[PLAID] liabilities error for ${institutionName}:`, plaidErr.message);
        }
      }
    }

    // Also get account balances for liability accounts
    const itemsSnap2 = await adminDb.collection("users").doc(userId)
      .collection("finance_profiles").doc(pId)
      .collection("plaid_items").where("status", "==", "active").get();

    let liabilityAccounts = [];
    for (const plaidDoc of itemsSnap2.docs) {
      const { accessToken, institutionName } = plaidDoc.data();
      try {
        const res = await plaidClient.accountsGet({ access_token: accessToken });
        const accts = (res.data.accounts || [])
          .filter(a => a.type === "credit" || a.type === "loan")
          .map(a => ({
            id: a.account_id,
            name: a.name,
            officialName: a.official_name,
            type: a.type,
            subtype: a.subtype,
            balanceCurrent: a.balances.current,
            balanceLimit: a.balances.limit,
            institution: institutionName,
            mask: a.mask,
          }));
        liabilityAccounts.push(...accts);
      } catch (e) { /* skip */ }
    }

    return Response.json({
      credit: allCredit,
      student: allStudent,
      mortgage: allMortgage,
      accounts: liabilityAccounts,
      env,
      profileId: pId,
    });
  } catch (error) {
    console.error("[PLAID] liabilities error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
