import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { ChangePasswordCommand, UserCommandDTO, UserDTO, UserSearchParam } from '../../../shared/model/user.model';
import { Page } from '../../../shared/model/types';
import { CustomExpressRequest } from '../express';
import { toUserDTO } from '../../service/user.service';

interface UserWithPassword {
  user: UserCommandDTO;
  password: string;
}

@Route('/api/users')
@Tags('Users')
/**
 * User Management API
 * @description Endpoints for managing user accounts and authentication
 */
export class UserController extends Controller {
  /**
   * Searches for users with optional filtering by login name
   * @summary Search users
   * @returns {Promise<Page<UserDTO>>} Paginated list of user accounts
   */
  @Get('/')
  async search(
    @Query() login: string | undefined,
    @Query() page: number | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<Page<UserDTO>> {
    const searchParams: UserSearchParam = {
      page: page ? parseInt(page.toString(), 10) : 0,
      login: login
    };

    const userService = request.services.userService;
    const pageResult = userService.search(searchParams);

    return {
      content: pageResult.content.map(element => toUserDTO(element)),
      totalElements: pageResult.totalElements,
      size: pageResult.size,
      number: pageResult.number,
      totalPages: pageResult.totalPages
    };
  }

  /**
   * Retrieves a specific user by their unique identifier
   * @summary Get user details
   * @returns {Promise<UserDTO>} The user account details
   */
  @Get('/{userId}')
  async findById(@Path() userId: string, @Request() request: CustomExpressRequest): Promise<UserDTO> {
    const userService = request.services.userService;
    return toUserDTO(userService.findById(userId));
  }

  /**
   * Creates a new user account with the provided details and password
   * @summary Create user
   * @returns {Promise<UserDTO>} The created user account
   */
  @Post('/')
  @SuccessResponse(201, 'User created successfully')
  async create(@Body() command: UserWithPassword, @Request() request: CustomExpressRequest): Promise<UserDTO> {
    const userService = request.services.userService;
    return toUserDTO(await userService.create(command.user, command.password));
  }

  /**
   * Updates an existing user account with new details
   * @summary Update user
   */
  @Put('/{userId}')
  @SuccessResponse(204, 'User updated successfully')
  async update(@Path() userId: string, @Body() command: UserCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const userService = request.services.userService;
    await userService.update(userId, command);
  }

  /**
   *  Updates a user's password
   * @summary Change password
   */
  @Post('/{userId}/password')
  @SuccessResponse(204, 'Password updated successfully')
  async updatePassword(
    @Path() userId: string,
    @Body() command: ChangePasswordCommand,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const userService = request.services.userService;
    await userService.updatePassword(userId, command.newPassword);
  }

  /**
   * Deletes a user account by its unique identifier
   * @summary Delete user
   */
  @Delete('/{userId}')
  @SuccessResponse(204, 'User deleted successfully')
  async delete(@Path() userId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const userService = request.services.userService;
    await userService.delete(userId);
  }
}
