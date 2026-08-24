'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'

// ─── FAQ Data ────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  id: string
  label: string
  items: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    id: 'general',
    label: 'Général',
    items: [
      {
        question: "Qu'est-ce que Mon Toit ?",
        answer:
          "Mon Toit est une plateforme de location immobilière de confiance en Côte d'Ivoire, développée par l'ANSUT. Elle connecte locataires et propriétaires dans un cadre sécurisé avec validation par des Tiers de Confiance indépendants.",
      },
      {
        question: 'Comment créer un compte sur Mon Toit ?',
        answer:
          "Pour créer un compte, cliquez sur 'S'inscrire' sur la page d'accueil. Vous pouvez vous inscrire avec votre numéro de téléphone ou votre adresse email. Un code OTP vous sera envoyé pour vérifier votre identité.",
      },
      {
        question: 'Mon Toit est-il gratuit ?',
        answer:
          'La consultation des annonces et la création de compte sont gratuites. Des frais de service peuvent s\'appliquer lors de la signature du bail et pour les services de vérification approfondie.',
      },
      {
        question: 'Dans quelles villes Mon Toit est-il disponible ?',
        answer:
          "Mon Toit est actuellement disponible à Abidjan et dans ses communes. Nous prévoyons de nous étendre à d'autres villes de Côte d'Ivoire prochainement.",
      },
    ],
  },
  {
    id: 'locataire',
    label: 'Locataire',
    items: [
      {
        question: 'Comment postuler à une location ?',
        answer:
          'Créez votre dossier locatif en ligne en fournissant les documents requis (pièce d\'identité, justificatifs de revenus, etc.). Votre dossier sera vérifié par un Tiers de Confiance pour renforcer votre candidature auprès des propriétaires.',
      },
      {
        question: "Qu'est-ce qu'un Tiers de Confiance ?",
        answer:
          "Un Tiers de Confiance (TC) est un acteur indépendant agréé par Mon Toit qui vérifie l'authenticité des dossiers locatifs, des titres de propriété et des états des lieux. Sa validation garantit la sécurité de la transaction.",
      },
      {
        question: 'Comment payer mon loyer ?',
        answer:
          'Mon Toit propose le paiement de loyer via mobile money (Orange Money, MTN MoMo, Moov Money, Wave). Vous recevrez une notification à chaque échéance et un reçu électronique après chaque paiement.',
      },
      {
        question: 'Que faire en cas de litige avec le propriétaire ?',
        answer:
          'Vous pouvez signaler un litige depuis votre espace locataire. Notre équipe de médiation et les Tiers de Confiance vous accompagneront pour trouver une résolution rapide et équitable.',
      },
    ],
  },
  {
    id: 'proprietaire',
    label: 'Propriétaire',
    items: [
      {
        question: 'Comment publier une annonce ?',
        answer:
          "Après inscription en tant que propriétaire, cliquez sur 'Ajouter un bien'. Remplissez les informations du logement, ajoutez des photos, et soumettez. Votre annonce sera vérifiée par un Tiers de Confiance avant publication.",
      },
      {
        question: 'Comment sont vérifiés les locataires ?',
        answer:
          "Chaque dossier locatif est examiné par un Tiers de Confiance qui vérifie l'identité, les revenus et les documents du candidat. Vous recevez un rapport détaillé pour prendre votre décision en toute connaissance de cause.",
      },
      {
        question: 'Quels sont les frais pour les propriétaires ?',
        answer:
          'La publication d\'annonces est gratuite. Des commissions ne s\'appliquent que lorsqu\'un bail est signé via la plateforme. Consultez notre grille tarifaire pour plus de détails.',
      },
      {
        question: 'Puis-je déléguer la gestion de mon bien ?',
        answer:
          "Oui, vous pouvez mandater une agence partenaire via un mandat de gestion. L'agence gérera les visites, la sélection des locataires et la gestion quotidienne de votre bien.",
      },
    ],
  },
  {
    id: 'securite',
    label: 'Sécurité & Vérification',
    items: [
      {
        question: "Comment fonctionne la vérification d'identité ?",
        answer:
          'Nous utilisons deux systèmes complémentaires : la vérification biométrique via NeoFace (reconnaissance faciale) et la vérification ONECI (Numéro National d\'Identification). Ces vérifications renforcent votre score de confiance.',
      },
      {
        question: "Qu'est-ce que le Score de Confiance ?",
        answer:
          'Le Score de Confiance évalue la fiabilité d\'un utilisateur sur 100 points. Il prend en compte votre profil (5%), la vérification KYC (20%), la validation ONECI (25%) et la complétude du dossier (50%). Un score élevé augmente vos chances auprès des propriétaires.',
      },
      {
        question: 'Mes données personnelles sont-elles sécurisées ?',
        answer:
          'Absolument. Nous utilisons un chiffrement de bout en bout, conformément à la loi CI. Vos documents sont stockés de manière sécurisée et ne sont partagés qu\'avec les Tiers de Confiance habilités dans le cadre de la vérification.',
      },
      {
        question: 'Comment fonctionne la signature électronique des baux ?',
        answer:
          'La signature se fait via CRYPTONEO, un service de signature électronique certifié. Chaque signataire reçoit un code OTP pour valider sa signature, garantissant l\'authenticité et la non-répudiation du contrat.',
      },
    ],
  },
]

// ─── FAQ Accordion Item ──────────────────────────────────────────────────────

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <Card className="border border-border/60 overflow-hidden transition-shadow hover:shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left group"
        aria-expanded={isOpen}
      >
        <span className="text-sm sm:text-base font-medium text-foreground group-hover:text-brand-600 transition-colors">
          {item.question}
        </span>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180 text-brand-500'
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

// ─── Main FAQ Component ──────────────────────────────────────────────────────

export function FAQ() {
  const { setView } = useAuthStore()
  const [activeCategory, setActiveCategory] = useState('general')
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const currentCategory = faqCategories.find((c) => c.id === activeCategory)!

  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-brand-50 text-brand-500 mb-5">
            <HelpCircle className="size-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            Foire Aux Questions
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Retrouvez les réponses aux questions les plus fréquemment posées sur Mon Toit.
            Si vous ne trouvez pas votre réponse, n&apos;hésitez pas à nous contacter.
          </p>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8 sm:mb-10"
        >
          <div className="flex flex-wrap gap-2 justify-center">
            {faqCategories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveCategory(cat.id)
                  setOpenItems(new Set())
                }}
                className={cn(
                  'rounded-full text-xs sm:text-sm font-medium transition-all',
                  activeCategory === cat.id
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-brand-600 hover:border-brand-300'
                )}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* FAQ Items */}
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="space-y-3"
        >
          {currentCategory.items.map((item, idx) => {
            const itemKey = `${activeCategory}-${idx}`
            return (
              <FAQAccordionItem
                key={itemKey}
                item={item}
                isOpen={openItems.has(itemKey)}
                onToggle={() => toggleItem(itemKey)}
              />
            )
          })}
        </motion.div>

        {/* Still have questions? */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 sm:mt-14 text-center"
        >
          <Card className="border border-brand-100 bg-brand-50/50 dark:bg-brand-950/20 dark:border-brand-900/40">
            <CardContent className="py-8 sm:py-10 px-6">
              <HelpCircle className="size-8 text-brand-400 mx-auto mb-3" />
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                Vous n&apos;avez pas trouvé votre réponse ?
              </h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                Notre équipe est disponible pour répondre à toutes vos questions et vous accompagner dans votre démarche.
              </p>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
                onClick={() => {
                  setView('nous-contacter')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Nous Contacter
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
