import { Controller } from '@nestjs/common';
import { LabGuard } from 'src/app/core/decorators/lab-guard.decorator';

@Controller('external-lab')
@LabGuard()
export class ExternalLabController {}
