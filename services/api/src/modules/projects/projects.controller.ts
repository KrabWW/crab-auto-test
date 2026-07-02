import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { MembershipGuard } from "./membership.guard";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser, type RequestUser } from "../../common/auth.decorators";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  AddMemberRequest,
} from "@crab/shared-types";

@Controller("projects")
@UseGuards(SessionAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projects.listForUser(user.userId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: CreateProjectRequest) {
    return this.projects.create(user.userId, body);
  }

  @Get(":projectId")
  @UseGuards(MembershipGuard)
  get(@Param("projectId") projectId: string) {
    return this.projects.get(projectId);
  }

  @Patch(":projectId")
  @UseGuards(MembershipGuard)
  update(
    @Param("projectId") projectId: string,
    @Body() body: UpdateProjectRequest,
  ) {
    return this.projects.update(projectId, body);
  }

  @Get(":projectId/members")
  @UseGuards(MembershipGuard)
  members(@Param("projectId") projectId: string) {
    return this.projects.listMembers(projectId);
  }

  @Post(":projectId/members")
  @UseGuards(MembershipGuard)
  addMember(
    @Param("projectId") projectId: string,
    @Body() body: AddMemberRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projects.addMember(projectId, body, user.userId);
  }
}
