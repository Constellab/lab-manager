import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class KeyGeneratorService {
  public generateRandomKey(length: number): string {
    return randomBytes(length).toString('base64').replace(/\W/g, '');
  }
}
