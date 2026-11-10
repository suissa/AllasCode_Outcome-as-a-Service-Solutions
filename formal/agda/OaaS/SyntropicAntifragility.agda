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

requiredProofBlocks : (g : PromotionGate) →
  proofRequired g ≡ true →
  proofPassed g ≡ false →
  promotable g ≡ false
requiredProofBlocks (gate _ _ _ _ true false _ _) refl refl = refl

missingEvidenceBlocks : (g : PromotionGate) →
  evidenceVerified g ≡ false →
  promotable g ≡ false
missingEvidenceBlocks (gate false _ _ _ _ _ _ _) refl = refl

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
