import {Injectable} from '@nestjs/common';
import {CommandService} from '../core/services/command/command.service';
import {CoreConfigService} from '../core/services/config/core-config.service';

@Injectable()
export class BackupService {

  private readonly prodDataZipName = 'prod-data.zip';

  constructor(private commandeService: CommandService,
    private configService: CoreConfigService) {

  }

  public zipProdDataFolder(): Promise<string> {
    const prodDataFolder = this.configService.getProdDataFolder();
    return this.commandeService.execCommand(`zip -r ${this.getProdDataZipPath()} ${prodDataFolder}`);
  }

  public deleteProdDataZip(): Promise<string> {
    return this.commandeService.execCommand(`rm ${this.getProdDataZipPath()}`);
  }

  public getProdDataZipPath(): string {
    return this.configService.getProdFolder() + '/' + this.prodDataZipName;
  }
}