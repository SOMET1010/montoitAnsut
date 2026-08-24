'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Building2, Landmark, ArrowRight, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'

interface Role {
  title: string
  description: string
  icon: React.ElementType
  cta: string
  roleValue: string
  benefits: string[]
  modalDescription: string
}

const roles: Role[] = [
  {
    title: 'Locataire',
    description:
      'Trouvez votre logement idéal, créez votre dossier locatif et signez votre bail en ligne',
    icon: Home,
    cta: 'Je cherche un logement',
    roleValue: 'LOCATAIRE',
    benefits: [
      'Accédez à des milliers de biens vérifiés en Côte d\'Ivoire',
      'Créez votre dossier locatif complet en ligne',
      'Demandez des visites et signez votre bail électroniquement',
      'Payez votre loyer en toute sécurité via la plateforme',
      'Bénéficiez de l\'accompagnement d\'un Tiers de Confiance',
    ],
    modalDescription:
      'En tant que locataire, Mon Toit vous accompagne dans toutes les étapes de votre recherche de logement : découverte de biens vérifiés, constitution de dossier, visites, signature du bail et paiement du loyer.',
  },
  {
    title: 'Propriétaire',
    description:
      'Publiez vos annonces, recevez des dossiers validés et gérez vos biens locatifs',
    icon: Building2,
    cta: 'Je publie une annonce',
    roleValue: 'PROPRIETAIRE',
    benefits: [
      'Publiez vos annonces et touchez des milliers de locataires',
      'Recevez des dossiers locatifs pré-validés par le Tiers de Confiance',
      'Gérez vos biens, visites et baux depuis un seul tableau de bord',
      'Encaissez vos loyers en toute sécurité',
      'Faites vérifier vos biens par un agent agréé',
    ],
    modalDescription:
      'En tant que propriétaire, Mon Toit vous offre une solution complète pour gérer vos biens locatifs : publication d\'annonces, réception de dossiers vérifiés, gestion des visites, signature électronique des baux et suivi des paiements.',
  },
  {
    title: 'Agence',
    description:
      'Gérez les biens de vos clients, publiez des annonces et suivez les dossiers locatifs',
    icon: Landmark,
    cta: 'Espace agence',
    roleValue: 'AGENCE',
    benefits: [
      'Gérez les biens de plusieurs propriétaires depuis un seul espace',
      'Publiez et gérez vos annonces en masse',
      'Suivez les dossiers locatifs de vos clients en temps réel',
      'Bénéficiez de statistiques détaillées sur vos performances',
      'Collaborez avec le Tiers de Confiance pour des dossiers fiables',
    ],
    modalDescription:
      'En tant qu\'agence immobilière, Mon Toit vous permet de gérer efficacement le portefeuille de biens de vos clients : publication multi-biens, suivi centralisé des dossiers, visites et baux, avec une interface professionnelle dédiée.',
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
} as const

function RoleCard({ role, onSelect }: { role: Role; onSelect: (role: Role) => void }) {
  const Icon = role.icon
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-xl border border-border p-6 sm:p-7 flex flex-col hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(role)}
    >
      <div className="size-12 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
        <Icon className="size-6 text-brand-500" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{role.title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5 flex-1">
        {role.description}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300"
      >
        {role.cta}
        <ArrowRight className="size-3.5 ml-1" />
      </Button>
    </motion.div>
  )
}

function RoleModal({
  role,
  open,
  onClose,
}: {
  role: Role | null
  open: boolean
  onClose: () => void
}) {
  const { setView, setPendingRole } = useAuthStore()

  if (!role) return null

  const Icon = role.icon

  const handleRegister = () => {
    setPendingRole(role.roleValue)
    onClose()
    setView('register')
  }

  const handleLogin = () => {
    onClose()
    setView('login')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-brand-500 to-brand-600 px-4 sm:px-6 pt-5 sm:pt-6 pb-6 sm:pb-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 size-7 sm:size-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-sm z-10"
            aria-label="Fermer"
          >
            <X className="size-3.5 sm:size-4 text-white" />
          </button>
          <div className="size-10 sm:size-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 sm:mb-4">
            <Icon className="size-5 sm:size-7 text-white" />
          </div>
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-lg sm:text-xl font-bold text-white leading-tight">
              {role.title}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs sm:text-sm mt-1.5 sm:mt-2 leading-relaxed">
              {role.modalDescription}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Benefits */}
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <p className="text-xs sm:text-sm font-semibold text-foreground mb-2.5 sm:mb-3">
            Ce que vous pouvez faire
          </p>
          <ul className="space-y-2 sm:space-y-2.5">
            {role.benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-2 sm:gap-2.5">
                <CheckCircle2 className="size-3.5 sm:size-4 text-brand-500 mt-0.5 shrink-0" />
                <span className="text-xs sm:text-sm text-muted-foreground leading-snug">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col gap-2 sm:gap-2.5">
          <Button
            onClick={handleRegister}
            className="w-full h-10 sm:h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm sm:text-base"
          >
            Créer un compte {role.title}
            <ArrowRight className="size-3.5 sm:size-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={handleLogin}
            className="w-full h-9 sm:h-10 text-xs sm:text-sm text-muted-foreground border-border hover:text-foreground"
          >
            J&apos;ai déjà un compte — Se connecter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Roles() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  return (
    <section className="py-16 sm:py-20 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Rejoignez Mon Toit
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Une plateforme pour chaque acteur de la location
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6"
        >
          {roles.map((role) => (
            <RoleCard key={role.title} role={role} onSelect={setSelectedRole} />
          ))}
        </motion.div>
      </div>

      {/* Modal */}
      <RoleModal
        role={selectedRole}
        open={selectedRole !== null}
        onClose={() => setSelectedRole(null)}
      />
    </section>
  )
}
