import { Controller, Get, Post, Patch, Delete, Body, Param, HttpException, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { EditPresetService } from './edit-preset.service';
import { JwtAuthGuard } from '../user/jwt-auth.guard';


@Controller('edit-presets')
export class EditPresetController {
  constructor(private readonly editPresetService: EditPresetService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: { name: string; config: any }, @Request() req) {
    try {
      return await this.editPresetService.create(req.user._id, body.name, body.config);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req) {
    try {
      return await this.editPresetService.findAll(req.user._id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    try {
      const preset = await this.editPresetService.findOne(id, req.user._id);
      if (!preset) {
        throw new HttpException('Preset not found', HttpStatus.NOT_FOUND);
      }
      return preset;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Request() req) {
    try {
      const preset = await this.editPresetService.update(id, req.user._id, body);
      if (!preset) {
        throw new HttpException('Preset not found', HttpStatus.NOT_FOUND);
      }
      return preset;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/set-default')
  async setDefault(@Param('id') id: string, @Request() req) {
    try {
      const preset = await this.editPresetService.setDefault(id, req.user._id);
      if (!preset) {
        throw new HttpException('Preset not found', HttpStatus.NOT_FOUND);
      }
      return preset;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    try {
      const success = await this.editPresetService.delete(id, req.user._id);
      if (!success) {
        throw new HttpException('Preset not found', HttpStatus.NOT_FOUND);
      }
      return { success: true };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
