import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EditPreset, EditPresetDocument } from './edit-preset.schema';

@Injectable()
export class EditPresetService {
  constructor(
    @InjectModel(EditPreset.name) private readonly editPresetModel: Model<EditPresetDocument>,
  ) {}

  async create(userId: string, name: string, config: any): Promise<EditPreset> {
    const preset = new this.editPresetModel({
      userId,
      name,
      config,
      isDefault: false,
    });
    return preset.save();
  }

  async findAll(userId: string): Promise<EditPreset[]> {
    return this.editPresetModel.find({ userId } as any).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, userId: string): Promise<EditPreset | null> {
    return this.editPresetModel.findOne({ _id: id, userId } as any).exec();
  }

  async findDefault(userId: string): Promise<EditPreset | null> {
    return this.editPresetModel.findOne({ userId, isDefault: true } as any).exec();
  }

  async update(id: string, userId: string, updates: Partial<EditPreset>): Promise<EditPreset | null> {
    return this.editPresetModel.findOneAndUpdate(
      { _id: id, userId } as any,
      updates,
      { new: true }
    ).exec();
  }

  async setDefault(id: string, userId: string): Promise<EditPreset | null> {
    // Unset all other defaults for this user
    await this.editPresetModel.updateMany(
      { userId, isDefault: true } as any,
      { isDefault: false }
    );

    // Set this one as default
    return this.editPresetModel.findOneAndUpdate(
      { _id: id, userId } as any,
      { isDefault: true },
      { new: true }
    ).exec();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.editPresetModel.deleteOne({ _id: id, userId } as any).exec();
    return result.deletedCount > 0;
  }
}
