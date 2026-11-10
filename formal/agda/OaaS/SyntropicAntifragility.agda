module OaaS.SyntropicAntifragility where

open import Agda.Builtin.Bool using (Bool; true; false)
open import Agda.Builtin.Equality using (_≡_; refl)

record PromotionGate : Set where
  constructor gate
  field
    evidenceVerified : Bool
    testsPassed : Bool
    policyApproved : Bool
    rollbackVerified : Bool
    proofRequired : Bool
    proofPassed : Bool
    humanRequired : Bool
    humanApproved : Bool

open PromotionGate

promotable : PromotionGate → Bool
promotable (gate true true true true false _ false _) = true
promotable (gate true true true true false _ true true) = true
promotable (gate true true true true true true false _) = true
promotable (gate true true true true true true true true) = true
promotable _ = false

-- Required proof failure blocks an otherwise fully approved promotion gate.
requiredProofBlocks : promotable (gate true true true true true false false false) ≡ false
requiredProofBlocks = refl

-- Missing evidence blocks promotion regardless of the other gate values.
missingEvidenceBlocks : (g : PromotionGate) →
  evidenceVerified g ≡ false →
  promotable g ≡ false
missingEvidenceBlocks (gate false _ _ _ _ _ _ _) refl = refl

-- Failed tests, policy denial and unverified rollback each block promotion.
failedTestsBlock : promotable (gate true false true true false false false false) ≡ false
failedTestsBlock = refl

policyDenialBlocks : promotable (gate true true false true false false false false) ≡ false
policyDenialBlocks = refl

unverifiedRollbackBlocks : promotable (gate true true true false false false false false) ≡ false
unverifiedRollbackBlocks = refl

-- A required human approval cannot be replaced by an agent decision.
missingHumanApprovalBlocks : promotable (gate true true true true false false true false) ≡ false
missingHumanApprovalBlocks = refl

record EvolutionResult : Set where
  constructor evolution
  field
    hasImprovement : Bool
    hasRegression : Bool

syntropicImprovement : EvolutionResult → Bool
syntropicImprovement (evolution true false) = true
syntropicImprovement _ = false

improvementRequiresNoRegression : syntropicImprovement (evolution true false) ≡ true
improvementRequiresNoRegression = refl

noImprovementMeansNoAntifragileClaim : syntropicImprovement (evolution false false) ≡ false
noImprovementMeansNoAntifragileClaim = refl

regressionMeansNoAntifragileClaim : syntropicImprovement (evolution true true) ≡ false
regressionMeansNoAntifragileClaim = refl
