import { test } from "node:test";
import assert from "node:assert/strict";
import { isSelfHosted, UNLIMITED_COUNT } from "./edition";
import {
  effectivePlanId,
  getPlan,
  isPaidPlan,
  isUnlimited,
  paidOwnerWhere,
} from "./plans";
import { requireSupportPlan, supportLimits } from "./support/policy";
import { billingEnabled } from "./stripe";

function withSelfHosted(value: string | undefined, run: () => void) {
  const previous = process.env.UPSTEP_SELF_HOSTED;
  if (value === undefined) delete process.env.UPSTEP_SELF_HOSTED;
  else process.env.UPSTEP_SELF_HOSTED = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.UPSTEP_SELF_HOSTED;
    else process.env.UPSTEP_SELF_HOSTED = previous;
  }
}

test("hosted plans apply when the self-hosted flag is unset or off", () => {
  for (const value of [undefined, "", "false", "0"])
    withSelfHosted(value, () => {
      assert.equal(isSelfHosted(), false);
      assert.equal(getPlan("FREE").projectLimit, 1);
      assert.equal(getPlan(null).name, "Free");
      assert.equal(effectivePlanId("FREE"), "FREE");
      assert.equal(isPaidPlan("FREE"), false);
      assert.equal(isPaidPlan("PRO"), true);
      assert.deepEqual(paidOwnerWhere(), {
        plan: { in: ["PRO", "BUSINESS"] },
      });
      assert.equal(supportLimits("FREE").enabled, false);
      assert.throws(() => requireSupportPlan("FREE"), /paid plans/);
    });
});

test("a self-hosted install lifts every plan limit and turns billing off", () => {
  for (const value of ["true", "TRUE", "1", "yes", " on "])
    withSelfHosted(value, () => {
      assert.equal(isSelfHosted(), true);
      const plan = getPlan("FREE");
      assert.equal(plan.name, "Self-hosted");
      assert.ok(isUnlimited(plan.projectLimit));
      assert.ok(isUnlimited(plan.feedbackLimit));
      assert.equal(plan.branding, false);
      assert.equal(plan.stripePriceId, undefined);
      assert.equal(effectivePlanId("FREE"), "BUSINESS");
      assert.equal(isPaidPlan(undefined), true);
      assert.deepEqual(paidOwnerWhere(), {});
      const limits = supportLimits("FREE");
      assert.equal(limits.enabled, true);
      assert.equal(limits.aiReplies, UNLIMITED_COUNT);
      assert.equal(limits.learningRuns, UNLIMITED_COUNT);
      assert.ok(Number.isInteger(limits.pages) && limits.pages > 150);
      assert.doesNotThrow(() => requireSupportPlan("FREE"));
      assert.equal(billingEnabled(), false);
    });
});
