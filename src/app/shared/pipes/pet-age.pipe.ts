import { Pipe, PipeTransform } from '@angular/core';

/** Human age from a 'YYYY-MM-DD' birth date: "3 ans", "1 an", "5 mois", "Moins d'un mois". */
export function petAge(birthDate: string, today = new Date()): string {
  const [year, month, day] = birthDate.split('-').map(Number);
  let months = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
  if (today.getDate() < day) months--;
  if (months < 1) return "Moins d'un mois";
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 an' : `${years} ans`;
}

@Pipe({ name: 'petAge' })
export class PetAgePipe implements PipeTransform {
  transform(birthDate: string): string {
    return petAge(birthDate);
  }
}
