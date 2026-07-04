import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MembershipGuard } from "../projects/membership.guard";
import { RequirementReviewService } from "./requirement-review.service";
import type { StartReviewRequest } from "@crab/shared-types";

@Controller("projects/:projectId")
@UseGuards(SessionAuthGuard, MembershipGuard)
export class RequirementReviewController {
  constructor(private readonly reviews: RequirementReviewService) {}

  @Get("requirements/documents/:docId/reports")
  listForDoc(@Param("projectId") projectId: string, @Param("docId") docId: string) {
    return this.reviews.listReports(projectId, docId);
  }

  @Get("requirements/review-reports/:reportId")
  get(@Param("projectId") projectId: string, @Param("reportId") reportId: string) {
    return this.reviews.getReport(projectId, reportId);
  }

  @Post("requirements/documents/:docId/start-review")
  start(
    @Param("projectId") projectId: string,
    @Param("docId") docId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: StartReviewRequest = {},
  ) {
    return this.reviews.startReview(projectId, docId, user.userId, body.providerId);
  }
}
