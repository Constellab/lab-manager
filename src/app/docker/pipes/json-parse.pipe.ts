import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class JsonParsePipe implements PipeTransform<string, any> {
  transform(value: string, metadata: ArgumentMetadata): any {
    if (!value) {
      throw new BadRequestException(`${metadata.data} cannot be empty`);
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      throw new BadRequestException(`${metadata.data} must be a valid JSON string`);
    }
  }
}