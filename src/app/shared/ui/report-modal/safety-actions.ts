import { Injectable, inject } from '@angular/core';
import { AlertController, ModalController, ToastController } from '@ionic/angular';

import { SafetyRepository } from '../../../core/safety/safety.repository';
import { type ReportChoice, ReportModalComponent } from './report-modal.component';

/** Who is being reported or blocked, and from where. */
export interface SafetyTarget {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly petId?: string | null;
  readonly matchId?: string | null;
}

/**
 * The report and block flows (dialogs + calls + feedback), identical on every
 * screen that offers them. Each method resolves to true when the owner ended up
 * blocked, so the caller can refresh or leave the screen.
 */
@Injectable({ providedIn: 'root' })
export class SafetyActions {
  private readonly repository = inject(SafetyRepository);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  async report(target: SafetyTarget): Promise<boolean> {
    const modal = await this.modals.create({ component: ReportModalComponent, componentProps: { ownerName: target.ownerName } });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<ReportChoice>();
    if (role !== 'report' || !data) return false;
    try {
      await this.repository.report({
        ownerId: target.ownerId,
        petId: target.petId,
        matchId: target.matchId,
        reason: data.reason,
        details: data.details,
      });
      if (data.block) await this.repository.block(target.ownerId);
      await this.toast(data.block ? 'Merci. Signalement envoyé et propriétaire bloqué.' : 'Merci, votre signalement a été envoyé.', 'success');
      return data.block;
    } catch {
      await this.toast("Le signalement n'a pas pu être envoyé. Réessayez.", 'danger');
      return false;
    }
  }

  async block(target: SafetyTarget): Promise<boolean> {
    const alert = await this.alerts.create({
      header: `Bloquer ${target.ownerName} ?`,
      message: 'Vous ne verrez plus ses animaux, et vos matchs et conversations avec ce propriétaire seront supprimés.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Bloquer', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return false;
    try {
      await this.repository.block(target.ownerId);
      await this.toast(`${target.ownerName} a été bloqué.`, 'success');
      return true;
    } catch {
      await this.toast('Le blocage a échoué. Réessayez.', 'danger');
      return false;
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2500, position: 'top' });
    await toast.present();
  }
}
