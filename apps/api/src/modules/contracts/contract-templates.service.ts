import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CONTRACT_TEMPLATE_NOT_FOUND,
  CONTRACT_TEMPLATE_INACTIVE,
  type ContractTemplateItem,
} from '@elmasaif/shared';

@Injectable()
export class ContractTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveTemplates(): Promise<ContractTemplateItem[]> {
    const templates = await this.prisma.contractTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return templates.map((t) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      version: t.version,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException({
        code: CONTRACT_TEMPLATE_NOT_FOUND,
        message: 'قالب العقد المحدد غير موجود',
      });
    }

    if (!template.isActive) {
      throw new BadRequestException({
        code: CONTRACT_TEMPLATE_INACTIVE,
        message: 'قالب العقد المحدد غير نشط',
      });
    }

    return template;
  }

  compileContractTerms(
    templateContent: string,
    variables: Record<string, string | number>,
  ): string {
    let result = templateContent;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    return result;
  }
}
