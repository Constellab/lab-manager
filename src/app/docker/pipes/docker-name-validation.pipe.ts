import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class DockerNameValidationPipe implements PipeTransform<string, string> {
  private readonly nameRegex = /^[a-zA-Z0-9_-]+$/;

  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      throw new BadRequestException(`${metadata.data} cannot be empty`);
    }

    if (!this.nameRegex.test(value)) {
      throw new BadRequestException(
        `${metadata.data} must contain only alphanumeric characters, hyphens (-), and underscores (_)`
      );
    }

    return value;
  }
}