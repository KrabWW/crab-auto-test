import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import type { AuditQuery } from "@crab/shared-types";

@Controller("audit")
@UseGuards(SessionAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  query(@Query() q: AuditQuery) {
    return this.audit.query(q);
  }
}
